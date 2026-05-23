export const preContent = `
const worldChain = {
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] } },
  blockExplorers: { default: { name: "Worldscan", url: "https://worldscan.org" } },
} as const satisfies chains.Chain;

const DEFAULT_POLLING_INTERVAL = 30_000;
const PRODUCTION_POLLING_INTERVAL = 300_000;
const configuredPollingInterval = Number(process.env.NEXT_PUBLIC_SCAFFOLD_POLLING_INTERVAL);
const scaffoldPollingInterval =
  Number.isFinite(configuredPollingInterval) && configuredPollingInterval > 0
    ? configuredPollingInterval
    : process.env.NODE_ENV === "production"
      ? PRODUCTION_POLLING_INTERVAL
      : DEFAULT_POLLING_INTERVAL;
`;

export const configOverrides = {
  targetNetworks: ["$$chains.base$$", "$$chains.celo$$", "$$worldChain$$"],
  pollingInterval: "$$scaffoldPollingInterval$$",
  alchemyApiKey: "$$process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || ''$$",
};

export const skipLocalChainInTargetNetworks = true;
