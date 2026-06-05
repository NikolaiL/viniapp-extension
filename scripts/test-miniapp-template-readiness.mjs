import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const provider = readFileSync("extension/packages/nextjs/components/MiniappProvider.tsx", "utf8");
const homePageTemplate = readFileSync("extension/packages/nextjs/app/page.tsx.args.mjs", "utf8");
const wagmiConfigTemplate = readFileSync("extension/packages/nextjs/services/web3/wagmiConfig.tsx.args.mjs", "utf8");

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
