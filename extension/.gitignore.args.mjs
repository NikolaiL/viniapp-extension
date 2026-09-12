// Appended to the generated app's root .gitignore (the create-eth base
// .gitignore.template.mjs consumes `postContent`). Editor/OS swap & temp files can
// capture a snapshot of the file they shadow (e.g. a nano swap of .env with live
// secrets), so they must never be committed. These root-level patterns cascade to
// every package, including packages/nextjs where such a swap file has leaked before.
// (.DS_Store is already ignored by the base template, so it is intentionally omitted.)
export const postContent = `
# editor swap/temp files
*.swp
*.swo
*.swn
.*.sw?
*~

# upstream Scaffold-ETH agent/editor config that is noise in a generated app
.mcp.json
opencode.json
.opencode/
.cursor/agents/
.cursor/mcp.json`;
