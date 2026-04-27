#!/usr/bin/env node
/**
 * ViniApp builder-code wirer.
 *
 * Patches packages/nextjs/hooks/scaffold-eth/useScaffoldWriteContract.ts in
 * place so every wagmi write carries an ERC-8021 dataSuffix derived from
 * services/web3/builderAttribution.ts. Idempotent: re-runs are no-ops.
 *
 * Why this exists: create-eth's extension copy uses { clobber: false }, so
 * dropping a same-named override file in extension/packages/nextjs/hooks/...
 * does not actually replace the base SE-2 hook. We patch in place via the
 * root package.json `postinstall` script.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nextjsRoot = path.resolve(__dirname, "..");
const hookPath = path.join(nextjsRoot, "hooks/scaffold-eth/useScaffoldWriteContract.ts");
const builderAttribPath = path.join(nextjsRoot, "services/web3/builderAttribution.ts");

const log = (msg) => console.log(`[viniapp-builder-codes] ${msg}`);
const warn = (msg) => console.warn(`[viniapp-builder-codes] ${msg}`);

if (!fs.existsSync(hookPath)) {
  warn(`skip: hook not found at ${path.relative(process.cwd(), hookPath)}`);
  process.exit(0);
}
if (!fs.existsSync(builderAttribPath)) {
  warn(`skip: services/web3/builderAttribution.ts missing — extension files not fully applied`);
  process.exit(0);
}

let content = fs.readFileSync(hookPath, "utf8");

if (content.includes("builderCodeDataSuffix")) {
  // already patched
  process.exit(0);
}

const importAnchor = `import { useDeployedContractInfo, useTransactor } from "~~/hooks/scaffold-eth";`;
const importInsert = `import { builderCodeDataSuffix } from "~~/services/web3/builderAttribution";`;

if (!content.includes(importAnchor)) {
  warn(`skip: import anchor not found (SE-2 hook layout may have changed)`);
  process.exit(0);
}

const writePattern = /(\s+)address: deployedContractData\.address,(\s+\.\.\.variables,)/g;
const writeMatches = content.match(writePattern);
if (!writeMatches || writeMatches.length === 0) {
  warn(`skip: write anchor not found (SE-2 hook layout may have changed)`);
  process.exit(0);
}

content = content.replace(importAnchor, `${importAnchor}\n${importInsert}`);
content = content.replace(
  writePattern,
  (_match, indent, rest) =>
    `${indent}address: deployedContractData.address,${indent}dataSuffix: builderCodeDataSuffix,${rest}`,
);

fs.writeFileSync(hookPath, content, "utf8");
log(
  `patched ${path.relative(process.cwd(), hookPath)} (${writeMatches.length} write site${writeMatches.length === 1 ? "" : "s"})`,
);
