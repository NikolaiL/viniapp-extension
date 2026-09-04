import { NextRequest, NextResponse } from "next/server";
import { clientIp, isJsonRequest, isSameOriginRequest, takeRateLimitToken } from "~~/utils/requestGuards";

/**
 * Error-beacon proxy: forwards runtime error reports from this app to the
 * ViniApp backend, which aggregates them per app (hash-deduped, throttled)
 * and feeds them back into the builder's enhancement context.
 *
 * Mirrors /api/track/open: the CDP proxy key is a SERVER-ONLY secret, so the
 * browser posts here and this route attaches the key. A beacon must never
 * break the app it watches — every failure path returns quietly.
 *
 * Abuse guards: JSON-only, same-origin-only, and a per-IP token bucket. All of
 * them fail SILENTLY with the same 204 as an accepted beacon so a probing
 * client cannot tell which gate dropped it. The bucket is in-memory and
 * per-instance (see utils/requestGuards.ts) — a nuisance cap, not a boundary.
 */

const MAX_MESSAGE_CHARS = 1000;
const MAX_ROUTE_CHARS = 300;
const RATE_LIMIT_EVENTS = 20;
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;

// Intentionally not wrapped in withErrorReporting: this IS the beacon.
// platform-invariant: error-beacon-proxy
export async function POST(request: NextRequest) {
  const cdpKey = process.env.CDP_PROXY_KEY;
  const backendUrl = process.env.VINIAPP_BACKEND;

  if (!cdpKey || !backendUrl) {
    return new NextResponse(null, { status: 204 });
  }

  if (
    !isJsonRequest(request) ||
    !isSameOriginRequest(request) ||
    !takeRateLimitToken("track-error", clientIp(request), RATE_LIMIT_EVENTS, RATE_LIMIT_WINDOW_MS)
  ) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const body = await request.json();

    const message = typeof body?.message === "string" ? body.message.slice(0, MAX_MESSAGE_CHARS) : "";
    if (!message.trim()) {
      return new NextResponse(null, { status: 204 });
    }

    // Forward a fixed field set only — never pass arbitrary client input
    // through to the backend.
    const payload: Record<string, string> = {
      message,
      source: body?.source === "server" ? "server" : "client",
    };
    if (typeof body?.route === "string" && body.route.startsWith("/")) {
      payload.route = body.route.slice(0, MAX_ROUTE_CHARS);
    }
    if (typeof body?.sqlstate === "string" && /^[0-9A-Z]{5}$/.test(body.sqlstate)) {
      payload.sqlstate = body.sqlstate;
    }

    await fetch(`${backendUrl}/api/track/error`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Viniapp-Cdp-Key": cdpKey,
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    /* never let the beacon surface an error of its own */
  }

  return new NextResponse(null, { status: 204 });
}
