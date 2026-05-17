export const preContent = `
const worldChain = {
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] } },
  blockExplorers: { default: { name: "Worldscan", url: "https://worldscan.org" } },
} as const satisfies chains.Chain;
`;

export const configOverrides = {
  targetNetworks: ["$$chains.base$$", "$$chains.celo$$", "$$worldChain$$"],
  alchemyApiKey: "$$process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || ''$$",
};
