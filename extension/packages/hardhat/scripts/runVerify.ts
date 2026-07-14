import "dotenv/config";
import { spawn } from "child_process";

const sharedEtherscanApiKey = "DNXJA8RX2Q3VZ4URQIWP7Z68CJXQZSC6AW";

/**
 * Forwards `yarn verify --network <name> [args]` to the rocketh-verify CLI.
 *
 * Keep this entrypoint independent from hardhat.config.ts exports. Generated
 * apps often customize that config, and verification should not fail at ESM
 * import time merely because a named helper export was removed.
 */
async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(
      [
        "Usage: yarn verify --network <name> [subcommand] [options]",
        "",
        "Subcommands: etherscan (default) | sourcify | blockscout | metadata",
        "",
        "Examples:",
        "  yarn verify --network optimismSepolia",
        "  yarn verify --network sepolia sourcify",
      ].join("\n"),
    );
    return;
  }

  const networkIdx = argv.indexOf("--network");
  const network = networkIdx !== -1 ? argv[networkIdx + 1] : "default";
  const forwarded = argv.filter((_, i) => i !== networkIdx && i !== networkIdx + 1);

  const subcommands = ["etherscan", "sourcify", "blockscout", "metadata"];
  const hasSubcommand = forwarded.some(arg => subcommands.includes(arg));
  const verifyArgs = ["-e", network, ...(hasSubcommand ? [] : ["etherscan"]), ...forwarded];

  const userKey = process.env.ETHERSCAN_API_KEY?.trim();
  const env = {
    ...process.env,
    ETHERSCAN_API_KEY: userKey || sharedEtherscanApiKey,
  };

  if (!userKey) {
    console.log(
      "ℹ️  Using shared Etherscan API key (rate-limited). Set your own ETHERSCAN_API_KEY in .env for production.\n",
    );
  }

  const child = spawn("rocketh-verify", verifyArgs, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });

  child.on("error", error => {
    console.error("Unable to start rocketh-verify:", error.message);
    process.exit(1);
  });

  child.on("exit", code => {
    process.exit(code ?? 1);
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
