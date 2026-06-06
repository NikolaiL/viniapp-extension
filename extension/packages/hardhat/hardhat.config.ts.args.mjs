// Adds World Chain (chainId 480) to the generated app's hardhat networks so ViniApp
// contracts can deploy + verify there. World Chain is not in the upstream create-eth
// template; keeping it here (in the owned ve extension) means it survives create-eth
// updates. deepMerge folds this into the template's `networks`, so if upstream later
// ships its own `worldChain` entry these merge by key (our values win on overlap).
//
// Verification relies on Etherscan V2 multichain (worldscan.org, chainId 480).
export const configOverrides = {
  networks: {
    worldChain: {
      type: "http",
      url: "https://worldchain-mainnet.g.alchemy.com/public",
      accounts: ["$$deployerPrivateKey$$"],
    },
  },
};
