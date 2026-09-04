export const preContent = `
    import { MiniappProvider } from "./MiniappProvider";
    import { AnalyticsScripts } from "./AnalyticsScripts";
    import scaffoldConfig from "~~/scaffold.config";
`;

// The base template builds the provider tree from
// `{ ...defaultProviders, ...extraProviders }`, merging BY PROVIDER NAME, so the
// `RainbowKitProvider` entry below REPLACES the base one (its position in the
// tree is kept). `avatar` and `theme` must therefore be copied verbatim from
// create-eth/templates/base/packages/nextjs/components/ScaffoldEthAppWithProviders.tsx.template.mjs
// whenever upstream changes them. `$$...$$` strings are emitted as raw JS.
//
// `initialChain` makes new wallet connections default to the app's target
// network (Base). Without it RainbowKit connects on whatever chain the wallet
// was last on — often Ethereum mainnet — and users are nagged by Scaffold-ETH's
// "Wrong network" dropdown. Connectors already on Base (Farcaster mini app,
// Base App, CDP embedded wallet) are unaffected.
export const extraProviders = {
  RainbowKitProvider: {
    avatar: "$$BlockieAvatar$$",
    theme: "$$mounted ? (isDarkMode ? darkTheme() : lightTheme()) : lightTheme()$$",
    initialChain: "$$scaffoldConfig.targetNetworks[0]$$",
  },
  AnalyticsScripts: {},
  MiniappProvider: {},
};
