// Reports uncaught browser errors through the app-local proxy. Module-level
// state provides per-page-load deduplication and throttling; the beacon itself
// must never throw or become a second runtime failure.

const MAX_PER_WINDOW = 5;
const WINDOW_MS = 60_000;
const MAX_MESSAGE_CHARS = 500;

// Non-actionable noise: nothing the builder can fix, and every report burns
// part of the per-app error budget. Matched against the first line only.
const IGNORED_MESSAGES: ReadonlyArray<string | RegExp> = [
  "Script error.", // cross-origin script threw; the browser hides all detail
  /user rejected/i, // wallet: the user declined a signature / transaction
  /\b4001\b/, // EIP-1193 userRejectedRequest code
  /AbortError/, // fetch cancelled by navigation or AbortController
  /ResizeObserver loop/, // benign browser layout notice
];

function isIgnoredMessage(message: string): boolean {
  return IGNORED_MESSAGES.some(pattern => (typeof pattern === "string" ? message === pattern : pattern.test(message)));
}

const seenMessages = new Set<string>();
let windowStartedAt = 0;
let messagesInWindow = 0;

export function reportClientError(rawMessage: unknown): void {
  try {
    const message = String(rawMessage ?? "")
      .split("\n")[0]
      .slice(0, MAX_MESSAGE_CHARS)
      .trim();
    if (!message || isIgnoredMessage(message)) return;

    const now = Date.now();
    if (now - windowStartedAt > WINDOW_MS) {
      windowStartedAt = now;
      messagesInWindow = 0;
    }
    if (messagesInWindow >= MAX_PER_WINDOW || seenMessages.has(message)) return;

    seenMessages.add(message);
    messagesInWindow += 1;

    void fetch("/api/track/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        route: window.location.pathname,
        source: "client",
      }),
    }).catch(() => {});
  } catch {
    /* never let the beacon become the error */
  }
}

/** Register global browser error listeners and return an idempotent cleanup. */
export function installClientErrorReporting(): () => void {
  if (typeof window === "undefined") return () => {};

  const onError = (event: ErrorEvent) => {
    reportClientError(event.message || event.error);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    reportClientError(reason instanceof Error ? reason.message : reason);
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
