// Behavioural tests for extension/packages/nextjs/utils/requestGuards.ts.
// Run by test-miniapp-template-readiness.mjs under `node --experimental-strip-types`
// (the module only has an erasable `import type`, so no bundler is needed).
import assert from "node:assert/strict";

const { clientIp, isJsonRequest, isSameOriginRequest, takeRateLimitToken } =
  await import("../extension/packages/nextjs/utils/requestGuards.ts");

const req = headers => ({ headers: new Headers(headers) });

// Fetch Metadata wins when present.
assert.equal(isSameOriginRequest(req({ "sec-fetch-site": "same-origin" })), true);
assert.equal(isSameOriginRequest(req({ "sec-fetch-site": "none" })), true);
assert.equal(
  isSameOriginRequest(req({ "sec-fetch-site": "cross-site", host: "app.example", origin: "https://evil.example" })),
  false,
  "cross-site page must be rejected",
);

// Host comparison fallback (older WebViews without Sec-Fetch-*).
assert.equal(isSameOriginRequest(req({ host: "app.example", origin: "https://app.example" })), true);
assert.equal(isSameOriginRequest(req({ host: "App.Example", origin: "https://app.example/" })), true);
assert.equal(isSameOriginRequest(req({ host: "app.example", referer: "https://app.example/play?x=1" })), true);
assert.equal(isSameOriginRequest(req({ host: "app.example", origin: "https://other.example" })), false);
assert.equal(isSameOriginRequest(req({ host: "app.example", origin: "null" })), false, "opaque origin is rejected");
assert.equal(isSameOriginRequest(req({ host: "app.example" })), false, "no origin/referer at all is rejected");
assert.equal(
  isSameOriginRequest(
    req({ host: "lambda.internal", "x-forwarded-host": "app.example", origin: "https://app.example" }),
  ),
  true,
  "platform-forwarded host is accepted",
);

process.env.NEXT_PUBLIC_URL = "https://my-app.vercel.app/";
assert.equal(
  isSameOriginRequest(req({ host: "127.0.0.1:3000", origin: "https://my-app.vercel.app" })),
  true,
  "NEXT_PUBLIC_URL host is accepted",
);
delete process.env.NEXT_PUBLIC_URL;

assert.equal(isJsonRequest(req({ "content-type": "application/json" })), true);
assert.equal(isJsonRequest(req({ "content-type": "Application/JSON; charset=utf-8" })), true);
assert.equal(isJsonRequest(req({ "content-type": "text/plain" })), false);
assert.equal(isJsonRequest(req({})), false);

assert.equal(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
assert.equal(clientIp(req({ "x-real-ip": "9.9.9.9" })), "9.9.9.9");
assert.equal(clientIp(req({})), "unknown");

for (let i = 0; i < 3; i++) {
  assert.equal(takeRateLimitToken("scope", "ip-a", 3, 60_000), true, `token ${i + 1} of 3`);
}
assert.equal(takeRateLimitToken("scope", "ip-a", 3, 60_000), false, "bucket is empty after the limit");
assert.equal(takeRateLimitToken("scope", "ip-b", 3, 60_000), true, "buckets are per key");
assert.equal(takeRateLimitToken("other-scope", "ip-a", 3, 60_000), true, "buckets are per scope");

console.log("request guards: ok");
