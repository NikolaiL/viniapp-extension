import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy API route for x402 requests
 * This avoids CORS issues by proxying requests through the Next.js server
 *
 * The x402 payment flow still works because:
 * 1. The proxy forwards the request and returns the 402 response
 * 2. The client signs the payment locally with the wallet
 * 3. The client retries through the proxy with the payment header
 */
export async function POST(request: NextRequest) {
  try {
    // Get the target URL from the query parameter
    const targetUrl = request.nextUrl.searchParams.get("url");

    if (!targetUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // Validate the URL is an allowed x402 endpoint
    const allowedHosts = ["gg402.vercel.app"];
    const url = new URL(targetUrl);
    if (!allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
    }

    // Get the request body
    const body = await request.text();

    // Forward ALL headers from the incoming request except host-related ones
    // This ensures we don't miss any x402 payment headers
    const headers: Record<string, string> = {};
    const skipHeaders = new Set(["host", "connection", "content-length", "transfer-encoding", "accept-encoding"]);

    // Log all incoming headers for debugging
    console.log("[x402 Proxy] === Incoming Request ===");
    console.log("[x402 Proxy] Target URL:", targetUrl);
    console.log("[x402 Proxy] Incoming headers:");

    request.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value.substring(0, 100)}${value.length > 100 ? "..." : ""}`);
      if (!skipHeaders.has(key.toLowerCase())) {
        headers[key] = value;
      }
    });

    console.log("[x402 Proxy] Forwarding headers:", Object.keys(headers));

    // Make the proxied request
    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: body || undefined,
    });

    // Get response body
    const responseBody = await response.text();

    // Log response for debugging
    console.log("[x402 Proxy] Response status:", response.status);
    console.log(
      "[x402 Proxy] Response headers:",
      [...response.headers.entries()].map(([k]) => k),
    );

    // Forward the response with all relevant headers
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", response.headers.get("Content-Type") || "application/json");

    // Forward x402 specific headers from the response
    // The x402 protocol uses "payment-required" header with Base64-encoded payment requirements
    const paymentRequiredHeader = response.headers.get("payment-required");
    if (paymentRequiredHeader) {
      responseHeaders.set("payment-required", paymentRequiredHeader);
    }

    const wwwAuth = response.headers.get("www-authenticate");
    if (wwwAuth) {
      responseHeaders.set("www-authenticate", wwwAuth);
    }

    // Forward any x-payment related headers
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith("x-payment") || lowerKey.startsWith("x-402") || lowerKey === "payment-required") {
        responseHeaders.set(key, value);
      }
    });

    // Add CORS headers to expose x402 headers to the browser
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Expose-Headers", "payment-required, x-payment, x-payment-response");

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 });
  }
}

// Handle preflight requests - allow all headers for x402 compatibility
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}
