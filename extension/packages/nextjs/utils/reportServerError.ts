import type { NextRequest } from "next/server";

/**
 * Server-side error reporter for API route handlers.
 *
 * Call from the catch block of every route handler that touches the database
 * or an external API:
 *
 *   } catch (err) {
 *     reportServerError(err, "/api/scores");
 *     return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
 *   }
 *
 * Reports flow to the ViniApp backend's error aggregate (hash-deduped,
 * throttled per app) and are injected into the builder's context on the next
 * enhancement — a Postgres SQLSTATE like 42P01 (missing table) or 42P18
 * (untyped bind parameter) arriving here is what lets the builder fix the
 * real failure instead of guessing from a user paraphrase.
 *
 * Fire-and-forget by design: never throws, never blocks the response.
 */

const MAX_MESSAGE_CHARS = 2000;

function extractSqlstate(err: unknown): string | undefined {
  // node-postgres / @neondatabase/serverless put the SQLSTATE in `code`.
  const code = (err as { code?: unknown })?.code;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : undefined;
}

export function reportServerError(err: unknown, route?: string): void {
  try {
    const cdpKey = process.env.CDP_PROXY_KEY;
    const backendUrl = process.env.VINIAPP_BACKEND;
    if (!cdpKey || !backendUrl) return;

    const raw = err instanceof Error ? err.message : String(err);
    // Strip embedded URL credentials (e.g. postgres://user:pass@host) before
    // this ever leaves the process — a beacon must not leak secrets.
    const redacted = raw.replace(/\/\/[^\s/@:]+:[^\s/@]+@/g, "//***:***@");
    const message = redacted.split("\n")[0]?.slice(0, MAX_MESSAGE_CHARS) ?? "";
    if (!message.trim()) return;

    const payload: Record<string, string> = { message, source: "server" };
    if (route) payload.route = route.slice(0, 300);
    const sqlstate = extractSqlstate(err);
    if (sqlstate) payload.sqlstate = sqlstate;

    void fetch(`${backendUrl}/api/track/error`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Viniapp-Cdp-Key": cdpKey,
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    /* a beacon must never take the app down with it */
  }
}

/**
 * Wrap an App Router route handler so any uncaught error is reported to the
 * platform (with the route name) and turned into a generic 500. Handlers that
 * catch and handle their own errors should still call reportServerError()
 * inside the catch block before responding.
 *
 *   export const POST = withErrorReporting("/api/scores", async (request) => { ... });
 *
 * `request` is typed `NextRequest`; dynamic routes (e.g. `[id]`) receive the
 * route's `context` (with `params`) as the second argument.
 */
export function withErrorReporting<Ctx = undefined>(
  route: string,
  handler: (request: NextRequest, context: Ctx) => Promise<Response> | Response,
): (request: NextRequest, context: Ctx) => Promise<Response> {
  return async (request: NextRequest, context: Ctx) => {
    try {
      return await handler(request, context);
    } catch (err) {
      reportServerError(err, route);
      return new Response(JSON.stringify({ error: "Something went wrong" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}
