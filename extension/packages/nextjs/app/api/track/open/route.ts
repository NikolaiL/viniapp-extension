import { NextRequest, NextResponse } from "next/server";

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
        const domain = request.headers.get("host") || new URL(backendUrl).hostname;

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

