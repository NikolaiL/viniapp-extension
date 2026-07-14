import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const provider = readFileSync("extension/packages/nextjs/components/MiniappProvider.tsx", "utf8");
const miniappLinks = readFileSync("extension/packages/nextjs/utils/miniappLinks.ts", "utf8");
const miniappTypes = readFileSync("extension/packages/nextjs/types/miniapp.ts", "utf8");
const homePageTemplate = readFileSync("extension/packages/nextjs/app/page.tsx.args.mjs", "utf8");
const wagmiConfigTemplate = readFileSync("extension/packages/nextjs/services/web3/wagmiConfig.tsx.args.mjs", "utf8");
const verifyScript = readFileSync("extension/packages/hardhat/scripts/runVerify.ts", "utf8");

assert.match(
  provider,
  /const readyPromise = sdk\.actions\.ready\(\)\.catch/,
  "MiniappProvider should not block context loading on sdk.actions.ready()",
);

assert.match(
  provider,
  /const sdkContext = await sdk\.context;/,
  "MiniappProvider should still load Farcaster context for generated apps",
);

assert.match(
  provider,
  /await readyPromise;/,
  "MiniappProvider should still wait for ready() before running follow-up host prompts",
);

assert.doesNotMatch(
  provider,
  /await sdk\.actions\.ready\(\);\s*\n\s*const sdkContext = await sdk\.context;/,
  "MiniappProvider should fetch context while ready() is in flight, not sequentially after it",
);

assert.match(
  homePageTemplate,
  /const environmentLabel = !isReady\s*\?\s*"Detecting environment"\s*:\s*isMiniApp\s*\?\s*"Running inside Farcaster"\s*:\s*"Running in browser";/,
  "Generated homepage should avoid browser/Farcaster status copy until MiniApp detection settles",
);

assert.match(
  wagmiConfigTemplate,
  /1:\s*\["https:\/\/ethereum-rpc\.publicnode\.com"\]/,
  "Generated wagmi config should use an explicit browser-safe Ethereum mainnet RPC instead of viem's default eth.merkle.io fallback",
);

assert.match(provider, /from "~~\/utils\/miniappLinks"/, "MiniappProvider should use shared navigation helpers");
assert.match(
  miniappLinks,
  /export function parseFarcasterComposeUrl/,
  "compose URL parsing should be independently testable",
);
assert.match(
  miniappLinks,
  /hostname\.endsWith\("\.farcaster\.xyz"\)/,
  "compose parsing should require a real Farcaster host",
);
assert.match(miniappLinks, /export function buildCaip19TokenId/, "token actions should share CAIP-19 construction");
assert.doesNotMatch(
  provider,
  /hostname\.includes\("warpcast\.com"\)/,
  "provider should not contain permissive inline host checks",
);
assert.match(provider, /from "~~\/types\/miniapp"/, "MiniappProvider should keep SDK context types outside React code");
assert.match(miniappTypes, /export type FullMiniAppContext/, "generated apps should receive reusable context types");
assert.match(miniappTypes, /export function resolveClientFid/, "client FID resolution should remain reusable");

assert.doesNotMatch(
  verifyScript,
  /from ["']\.\.\/hardhat\.config\.js["']/,
  "Generated verification should not depend on named hardhat config exports",
);
assert.match(
  verifyScript,
  /process\.env\.ETHERSCAN_API_KEY\?\.trim\(\)/,
  "Generated verification should prefer an app owner's Etherscan key",
);
assert.match(
  verifyScript,
  /userKey \|\| sharedEtherscanApiKey/,
  "Generated verification should retain Scaffold-ETH's public shared key fallback",
);
