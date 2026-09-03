import { NextRequest, NextResponse } from "next/server";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
import { clientIp, isSameOriginRequest, takeRateLimitToken } from "~~/utils/requestGuards";

// Per-IP open-event cap. In-memory and per-instance (see utils/requestGuards.ts).
const RATE_LIMIT_EVENTS = 60;
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;

/**
 * Resolve the app's own domain from TRUSTED configuration for Farcaster JWT
 * verification. Never derive it from the request Host header, which an attacker
 * can forge to verify a token issued for a different domain.
 */
function trustedDomain(backendUrl: string): string {
  const explicit = process.env.NEXT_PUBLIC_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).hostname;
    } catch {
      /* fall through */
    }
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return vercelUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }

  return new URL(backendUrl).hostname;
}

export const POST = withErrorReporting("/api/track/open", async (request: NextRequest) => {
  const cdpKey = process.env.CDP_PROXY_KEY;
  const backendUrl = process.env.VINIAPP_BACKEND;

  if (!cdpKey || !backendUrl) {
    return NextResponse.json({ success: true, skipped: true });
  }

  // Only this app's own pages may record opens, and only at a sane rate.
  // Rejections answer exactly like the "not configured" path above so a
  // cross-site caller learns nothing.
  if (
    !isSameOriginRequest(request) ||
    !takeRateLimitToken("track-open", clientIp(request), RATE_LIMIT_EVENTS, RATE_LIMIT_WINDOW_MS)
  ) {
    return NextResponse.json({ success: true, skipped: true });
  }

  try {
    const body = await request.json();
    const { fc_token, fid, username, ...rest } = body;

    let fcVerified = false;
    let verifiedFid = fid;
    let verifiedUsername = username;

    if (fc_token) {
      try {
        const { createClient } = await import("@farcaster/quick-auth");
        const client = createClient();
        const domain = trustedDomain(backendUrl);

        const payload = await client.verifyJwt({ token: fc_token, domain });
        fcVerified = true;
        verifiedFid = typeof payload.sub === "string" ? parseInt(payload.sub, 10) : payload.sub;
      } catch {
        fcVerified = false;
        verifiedFid = null;
        verifiedUsername = null;
      }
    }

    const trackingData = {
      ...rest,
      fid: verifiedFid,
      username: verifiedUsername,
      fc_verified: fcVerified,
    };

    const response = await fetch(`${backendUrl}/api/track/open`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Viniapp-Cdp-Key": cdpKey,
      },
      body: JSON.stringify(trackingData),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    reportServerError(err, "/api/track/open");
    return NextResponse.json({ success: false, error: "Tracking failed" }, { status: 500 });
  }
});
