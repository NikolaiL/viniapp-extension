// Reference the example args file: https://github.com/scaffold-eth/create-eth-extensions/blob/example/extension/packages/nextjs/services/web3/wagmiConfig.tsx.args.mjs
// Reference the template file that will use this file: https://github.com/scaffold-eth/create-eth/blob/main/templates/base/packages/nextjs/services/web3/wagmiConfig.tsx.template.mjs

// Default args:
export const preContent = `
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";
`;

export const configOverrides = {
  connectors: `$$[miniAppConnector(), ...wagmiConnectors()]$$`,
  client: `$$({ chain }) => { const publicRpcUrlsByChain: Record<number, string[]> = { 8453: ["https://base-rpc.publicnode.com", "https://mainnet.base.org"], 42220: ["https://celo-rpc.publicnode.com"], 480: ["https://worldchain-mainnet.g.alchemy.com/public"] }; const publicFallbacks = (publicRpcUrlsByChain[chain.id] ?? []).map(url => http(url)); if (publicFallbacks.length === 0) { publicFallbacks.push(http()); } let rpcFallbacks = publicFallbacks; const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ScaffoldConfig["rpcOverrides"])?.[chain.id]; if (rpcOverrideUrl) { rpcFallbacks = [http(rpcOverrideUrl), ...publicFallbacks]; } else { const alchemyHttpUrl = getAlchemyHttpUrl(chain.id); if (alchemyHttpUrl) { rpcFallbacks = [...publicFallbacks, http(alchemyHttpUrl)]; } } return createClient({ chain, transport: fallback(rpcFallbacks), ...(chain.id !== (hardhat as Chain).id ? { pollingInterval: scaffoldConfig.pollingInterval } : {}), }); }$$`,
};
