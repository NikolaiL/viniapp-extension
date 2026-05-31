import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  const cdpKey = process.env.CDP_PROXY_KEY;
  const backendUrl = process.env.VINIAPP_BACKEND;

  if (!cdpKey || !backendUrl) {
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
  } catch {
    return NextResponse.json({ success: false, error: "Tracking failed" }, { status: 500 });
  }
}
