// Reference the example args file: https://github.com/scaffold-eth/create-eth-extensions/blob/example/extension/packages/nextjs/services/web3/wagmiConfig.tsx.args.mjs
// Reference the template file that will use this file: https://github.com/scaffold-eth/create-eth/blob/main/templates/base/packages/nextjs/services/web3/wagmiConfig.tsx.template.mjs

// Default args:
export const preContent = `
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";
import { injected } from "wagmi/connectors";

// The Base App / Coinbase in-app browser is a standard web app + wallet with NO
// Farcaster SDK. The Farcaster mini-app connector's reconnect calls that SDK and
// hangs, which stalls wagmi's reconnectOnMount at status="connecting" forever and
// blocks coinbaseWallet from reconnecting. So exclude the Farcaster connector when
// running in the Coinbase runtime. Detected at module load, SSR-safe.
const isCoinbaseRuntime =
  typeof window !== "undefined" &&
  (!!(window as any).ethereum?.isCoinbaseBrowser ||
    !!(window as any).ethereum?.isCoinbaseWallet ||
    (Array.isArray((window as any).ethereum?.providers) &&
      (window as any).ethereum.providers.some((p: any) => p?.isCoinbaseBrowser || p?.isCoinbaseWallet)) ||
    /CoinbaseBrowser|CoinbaseWallet|CoinbaseApp/i.test(typeof navigator !== "undefined" ? navigator.userAgent : ""));
`;

export const configOverrides = {
  // injected() targets the host-injected window.ethereum provider — required to
  // connect the wallet inside the Base App in-app browser (a standard web app +
  // wallet, no Farcaster wallet bridge) and other mobile wallet browsers.
  // miniAppConnector() is gated out of the Coinbase runtime (see isCoinbaseRuntime
  // above) so its hung reconnect cannot stall wagmi in the Base App.
  connectors: `$$[...(isCoinbaseRuntime ? [] : [miniAppConnector()]), injected({ shimDisconnect: true }), ...wagmiConnectors()]$$`,
  client: `$$({ chain }) => { const publicRpcUrlsByChain: Record<number, string[]> = { 1: ["https://ethereum-rpc.publicnode.com"], 8453: ["https://base-rpc.publicnode.com", "https://mainnet.base.org"], 42220: ["https://celo-rpc.publicnode.com"], 480: ["https://worldchain-mainnet.g.alchemy.com/public"] }; const publicFallbacks = (publicRpcUrlsByChain[chain.id] ?? []).map(url => http(url)); if (publicFallbacks.length === 0) { publicFallbacks.push(http()); } let rpcFallbacks = publicFallbacks; const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ScaffoldConfig["rpcOverrides"])?.[chain.id]; if (rpcOverrideUrl) { rpcFallbacks = [http(rpcOverrideUrl), ...publicFallbacks]; } else { const alchemyHttpUrl = getAlchemyHttpUrl(chain.id); if (alchemyHttpUrl) { rpcFallbacks = [...publicFallbacks, http(alchemyHttpUrl)]; } } return createClient({ chain, transport: fallback(rpcFallbacks), ...(chain.id !== (hardhat as Chain).id ? { pollingInterval: scaffoldConfig.pollingInterval } : {}), }); }$$`,
};
