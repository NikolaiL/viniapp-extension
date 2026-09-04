import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextjs = "extension/packages/nextjs";
const read = relativePath => readFileSync(join(repoRoot, relativePath), "utf8");
// assert.match/doesNotMatch print the whole file on failure; keep failures readable.
const must = (text, pattern, message) => assert.ok(pattern.test(text), message);
const mustNot = (text, pattern, message) => assert.ok(!pattern.test(text), message);

const provider = read(`${nextjs}/components/MiniappProvider.tsx`);
const miniappLinks = read(`${nextjs}/utils/miniappLinks.ts`);
const miniappTypes = read(`${nextjs}/types/miniapp.ts`);
const homePageTemplate = read(`${nextjs}/app/page.tsx.args.mjs`);
const wagmiConfigTemplate = read(`${nextjs}/services/web3/wagmiConfig.tsx.args.mjs`);
const verifyScript = read("extension/packages/hardhat/scripts/runVerify.ts");
const errorRoute = read(`${nextjs}/app/api/track/error/route.ts`);
const openRoute = read(`${nextjs}/app/api/track/open/route.ts`);
const requestGuards = read(`${nextjs}/utils/requestGuards.ts`);
const clientErrorReporter = read(`${nextjs}/utils/reportClientError.ts`);
const nextjsPackageJson = JSON.parse(read(`${nextjs}/package.json`));
const x402Hook = read(`${nextjs}/hooks/useX402Fetch.ts`);
const wagmiConnectors = read(`${nextjs}/services/web3/wagmiConnectors.tsx`);
const metadataTemplate = read(`${nextjs}/utils/scaffold-eth/getMetadata.ts.args.mjs`);
const manifestRoute = read(`${nextjs}/app/.well-known/farcaster.json/route.ts`);
const readmeTemplate = read("extension/README.md.args.mjs");
const providersArgs = await import(
  pathToFileURL(join(repoRoot, `${nextjs}/components/ScaffoldEthAppWithProviders.tsx.args.mjs`)).href
);

// --- Launch flow -----------------------------------------------------------

must(
  provider,
  /\bconst callReady = /,
  "MiniappProvider should define the callReady helper (platform checklists grep for it)",
);
must(
  provider,
  /\bsdk\s*\.\s*actions\s*\.\s*ready\s*\(/,
  "MiniappProvider must call sdk.actions.ready() (platform invariant miniapp_ready)",
);
must(
  provider,
  /const readyPromise = callReady\(\);/,
  "MiniappProvider should fire ready() through callReady() without awaiting it",
);
// Order inside the init effect: ready() is fired before any host detection.
// (openLink/openProfile also call sdk.isInMiniApp() earlier in the file, so
// search from the effect onwards.)
const initEffectStart = provider.indexOf("const readyPromise = callReady();");
assert.ok(
  initEffectStart > -1 && provider.indexOf("const initialize = async") > initEffectStart,
  "callReady() must be fired at the top of the init effect, before initialize()",
);
assert.ok(
  provider.indexOf("sdk.isInMiniApp()", initEffectStart) > -1 &&
    provider.indexOf("detectViniPlatform(false)", initEffectStart) > -1,
  "the init effect must still detect injected-provider hosts first and race sdk.isInMiniApp() after firing ready()",
);
must(
  provider,
  /const sdkContext = await sdk\.context;/,
  "MiniappProvider should still load Farcaster context for generated apps",
);
must(
  provider,
  /await readyPromise;/,
  "MiniappProvider should still wait for ready() before running follow-up host prompts",
);
mustNot(
  provider,
  /await sdk\.actions\.ready\(\);\s*\n\s*const sdkContext = await sdk\.context;/,
  "MiniappProvider should fetch context while ready() is in flight, not sequentially after it",
);
mustNot(provider, /console\.log\("composeCast processing"/, "stray composeCast debug logging must not ship");

must(
  homePageTemplate,
  /const environmentLabel = !isReady\s*\?\s*"Detecting environment"\s*:\s*isMiniApp\s*\?\s*"Running inside Farcaster"\s*:\s*"Running in browser";/,
  "Generated homepage should avoid browser/Farcaster status copy until MiniApp detection settles",
);

// --- Provider tree (RainbowKit initialChain) --------------------------------

must(
  providersArgs.preContent,
  /import scaffoldConfig from "~~\/scaffold\.config";/,
  "providers preContent must import scaffoldConfig",
);
assert.deepEqual(
  providersArgs.extraProviders.RainbowKitProvider,
  {
    // Must stay byte-identical to defaultProviders.RainbowKitProvider in
    // create-eth/templates/base/packages/nextjs/components/ScaffoldEthAppWithProviders.tsx.template.mjs
    // because the base merges providers by name and this entry replaces it.
    avatar: "$$BlockieAvatar$$",
    theme: "$$mounted ? (isDarkMode ? darkTheme() : lightTheme()) : lightTheme()$$",
    initialChain: "$$scaffoldConfig.targetNetworks[0]$$",
  },
  "RainbowKitProvider override must keep the base avatar/theme and add initialChain",
);
assert.deepEqual(
  Object.keys(providersArgs.extraProviders),
  ["RainbowKitProvider", "AnalyticsScripts", "MiniappProvider"],
  "extraProviders must keep MiniappProvider nested inside the RainbowKit/wagmi tree",
);

// --- Wagmi / RPC -------------------------------------------------------------

must(
  wagmiConfigTemplate,
  /1:\s*\["https:\/\/ethereum-rpc\.publicnode\.com"\]/,
  "Generated wagmi config should use an explicit browser-safe Ethereum mainnet RPC instead of viem's default eth.merkle.io fallback",
);
must(
  x402Hook,
  /usePublicClient\(\{ chainId: base\.id \}\)/,
  "x402 hook must use the app's configured wagmi public client",
);
mustNot(
  x402Hook,
  /import \{[^}]*\bcreatePublicClient\b[^}]*\} from "viem"/,
  "x402 hook must not create an ad-hoc viem client on the public default RPC",
);
must(x402Hook, /!publicClient\)/, "x402 hook must handle an undefined public client");

// --- Beacon routes -----------------------------------------------------------

must(
  errorRoute,
  /^\/\/ platform-invariant: error-beacon-proxy$/m,
  "error beacon must keep the platform invariant marker line",
);
mustNot(errorRoute, /withErrorReporting\(/, "error beacon must not report through itself");
for (const guard of ["isJsonRequest(request)", "isSameOriginRequest(request)", 'takeRateLimitToken("track-error"']) {
  assert.ok(errorRoute.includes(guard), `error beacon must gate on ${guard}`);
}
must(errorRoute, /const MAX_MESSAGE_CHARS = 1000;/, "error beacon caps message at 1000 chars");
must(errorRoute, /body\.route\.startsWith\("\/"\)/, "error beacon only forwards routes starting with /");
assert.ok(
  errorRoute.split("\n").filter(line => /status: 204/.test(line)).length >= 3 && !/status: (4|5)\d\d/.test(errorRoute),
  "error beacon must answer rejections with the same silent 204 as accepted beacons",
);

for (const guard of ["isSameOriginRequest(request)", 'takeRateLimitToken("track-open"']) {
  assert.ok(openRoute.includes(guard), `open tracking must gate on ${guard}`);
}
must(openRoute, /client\.verifyJwt\(\{ token: fc_token, domain \}\)/, "open tracking must keep the verified-fid path");
must(openRoute, /withErrorReporting\("\/api\/track\/open"/, "open tracking stays wrapped in withErrorReporting");
must(requestGuards, /PER INSTANCE/, "requestGuards must document that the rate limiter is per instance");

const guardTest = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--no-warnings", join(repoRoot, "scripts/test-request-guards.mjs")],
  {
    encoding: "utf8",
  },
);
if (guardTest.status === 0) {
  process.stdout.write(guardTest.stdout);
} else if (/bad option|--experimental-strip-types/.test(guardTest.stderr) && !/AssertionError/.test(guardTest.stderr)) {
  console.warn(`request guards: SKIPPED (node ${process.version} cannot strip types; use Node >= 22.6)`);
} else {
  process.stderr.write(guardTest.stderr);
  assert.fail("request guard behavioural tests failed");
}

// --- Client error reporting -------------------------------------------------

must(
  clientErrorReporter,
  /isIgnoredMessage\(message\)\) return;/,
  "client error reporter must drop denylisted messages",
);
for (const pattern of [
  '"Script error."',
  "/user rejected/i",
  "/\\b4001\\b/",
  "/AbortError/",
  "/ResizeObserver loop/",
]) {
  assert.ok(clientErrorReporter.includes(pattern), `client error denylist must include ${pattern}`);
}
mustNot(
  clientErrorReporter,
  /\/Load failed\//,
  "client error reporter must preserve Safari's generic network failures for CORS/API/RPC diagnosis",
);

// --- Dependencies ------------------------------------------------------------

// @x402/svm is never imported here, but a fresh scaffold's `next build` fails
// without it: rainbowkit -> @wagmi/connectors baseAccount -> @base-org/account
// -> @coinbase/cdp-sdk dynamically imports "@x402/svm/exact/client", which
// Turbopack resolves at build time. Keep it until that chain drops it.
assert.ok(
  nextjsPackageJson.dependencies["@x402/svm"],
  "@x402/svm must stay: @coinbase/cdp-sdk (via rainbowkit) imports it at build time",
);
assert.equal(
  nextjsPackageJson.dependencies.ethers,
  undefined,
  "ethers is unused in the nextjs package (viem/wagmi only)",
);
assert.equal(
  nextjsPackageJson.dependencies["@x402/evm"],
  nextjsPackageJson.dependencies["@x402/fetch"],
  "@x402/evm and @x402/fetch must pin the same range",
);

// --- Branding / manifest -----------------------------------------------------

must(
  wagmiConnectors,
  /appName: process\.env\.NEXT_PUBLIC_APP_NAME \|\| "ViniApp"/,
  "wallet appName must use the app's name",
);
mustNot(wagmiConnectors, /scaffold-eth-2/, "wallet appName must not leak the scaffold name");
must(metadataTemplate, /export const titleTemplate = "%s";/, "page titles must not be suffixed with the scaffold name");
must(
  manifestRoute,
  /NEXT_PUBLIC_APP_ICON \|\| "\/viniapp-icon\.png"/,
  "manifest iconUrl must default to the compliant icon shipped by the extension",
);
must(
  manifestRoute,
  /NEXT_PUBLIC_APP_SPLASH_IMAGE \|\| "\/viniapp-splash\.png"/,
  "manifest splashImageUrl must default to the compliant splash shipped by the extension",
);
const pngInfo = relativePath => {
  const data = readFileSync(join(repoRoot, relativePath));
  assert.deepEqual(
    [...data.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${relativePath} must be a PNG`,
  );
  assert.equal(data.subarray(12, 16).toString("ascii"), "IHDR", `${relativePath} must start with IHDR`);
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    colorType: data[25],
  };
};
assert.deepEqual(
  pngInfo(`${nextjs}/public/viniapp-icon.png`),
  { width: 1024, height: 1024, colorType: 2 },
  "default Farcaster icon must be a 1024x1024 RGB PNG without alpha",
);
assert.deepEqual(
  pngInfo(`${nextjs}/public/viniapp-splash.png`),
  { width: 200, height: 200, colorType: 2 },
  "default Farcaster splash must be a 200x200 RGB PNG without alpha",
);
must(
  manifestRoute,
  /webhookUrl: absoluteUrl\(process\.env\.NEXT_PUBLIC_WEBHOOK_URL, baseUrl\)/,
  "manifest must omit webhookUrl unless configured",
);
mustNot(manifestRoute, /"\/api\/webhook"/, "manifest must not advertise a webhook route the scaffold does not ship");
mustNot(readmeTemplate, /farcatser/, "README typo");

// --- Hardhat verify ------------------------------------------------------------

mustNot(
  verifyScript,
  /from ["']\.\.\/hardhat\.config\.js["']/,
  "Generated verification should not depend on named hardhat config exports",
);
must(
  verifyScript,
  /process\.env\.ETHERSCAN_API_KEY\?\.trim\(\)/,
  "Generated verification should prefer an app owner's Etherscan key",
);
must(
  verifyScript,
  /userKey \|\| sharedEtherscanApiKey/,
  "Generated verification should retain Scaffold-ETH's public shared key fallback",
);

// --- Shared helpers -----------------------------------------------------------

must(provider, /from "~~\/utils\/miniappLinks"/, "MiniappProvider should use shared navigation helpers");
must(miniappLinks, /export function parseFarcasterComposeUrl/, "compose URL parsing should be independently testable");
must(miniappLinks, /hostname\.endsWith\("\.farcaster\.xyz"\)/, "compose parsing should require a real Farcaster host");
must(miniappLinks, /export function buildCaip19TokenId/, "token actions should share CAIP-19 construction");
mustNot(provider, /hostname\.includes\("warpcast\.com"\)/, "provider should not contain permissive inline host checks");
must(provider, /from "~~\/types\/miniapp"/, "MiniappProvider should keep SDK context types outside React code");
must(miniappTypes, /export type FullMiniAppContext/, "generated apps should receive reusable context types");
must(miniappTypes, /export function resolveClientFid/, "client FID resolution should remain reusable");

// --- Prettier (a fresh scaffold must lint clean) ------------------------------
//
// create-eth runs `yarn format` after scaffolding, but the generated app's
// `eslint .` (prettier/prettier) also flags files the extension ships
// unformatted. Both base configs are mirrored here:
//   packages/nextjs  -> create-eth/templates/base/packages/nextjs/.prettierrc.js (sort-imports plugin)
//   packages/hardhat -> create-eth/templates/solidity-frameworks/hardhat/packages/hardhat/.prettierrc.json
// Needs the repo-root devDependencies installed (`yarn install` / `npm install`
// at the repo root); otherwise the check is skipped, or fails with
// VE_REQUIRE_PRETTIER=1.

function resolvePrettier() {
  try {
    const require = createRequire(join(repoRoot, "package.json"));
    const prettierBin = join(dirname(require.resolve("prettier/package.json")), "bin/prettier.cjs");
    const sortImportsPlugin = require.resolve("@trivago/prettier-plugin-sort-imports");
    return existsSync(prettierBin) ? { prettierBin, sortImportsPlugin } : null;
  } catch {
    return null;
  }
}

const prettier = resolvePrettier();
if (!prettier) {
  const message = "prettier check: SKIPPED (run `yarn install` at the repo root to enable it)";
  if (process.env.VE_REQUIRE_PRETTIER) assert.fail(message);
  console.warn(message);
} else {
  const configDir = mkdtempSync(join(tmpdir(), "ve-prettier-"));
  const shared = { arrowParens: "avoid", printWidth: 120, tabWidth: 2, trailingComma: "all" };
  const nextjsConfig = join(configDir, "nextjs.json");
  writeFileSync(
    nextjsConfig,
    JSON.stringify({
      ...shared,
      importOrder: ["^react$", "^next/(.*)$", "<THIRD_PARTY_MODULES>", "^@heroicons/(.*)$", "^~~/(.*)$"],
      importOrderSortSpecifiers: true,
      plugins: [prettier.sortImportsPlugin],
    }),
  );
  const hardhatConfig = join(configDir, "hardhat.json");
  writeFileSync(hardhatConfig, JSON.stringify(shared));

  for (const [config, pattern] of [
    [nextjsConfig, `${nextjs}/**/*.{ts,tsx}`],
    [hardhatConfig, "extension/packages/hardhat/**/*.ts"],
  ]) {
    try {
      execFileSync(process.execPath, [prettier.prettierBin, "--config", config, "--check", pattern], {
        cwd: repoRoot,
        stdio: "pipe",
        encoding: "utf8",
      });
    } catch (error) {
      process.stderr.write(`${error.stdout ?? ""}${error.stderr ?? ""}`);
      assert.fail(`prettier check failed for ${pattern} (run prettier --write with the base template config)`);
    }
  }
  console.log("prettier check: ok");
}

console.log("miniapp template readiness: ok");
