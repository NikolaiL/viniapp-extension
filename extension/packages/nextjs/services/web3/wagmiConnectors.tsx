import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { rainbowkitBurnerWallet } from "burner-connector";
import * as chains from "viem/chains";
import scaffoldConfig, { type ScaffoldConfig } from "~~/scaffold.config";

// ViniApp override of the base Scaffold-ETH wallet list.
//
// The base template ships RainbowKit's `baseAccount` wallet. Its connector hangs
// during wagmi's `reconnectOnMount` inside the Base App in-app browser — the app
// gets stuck at status="connecting" (and `connect()` throws "Connector already
// connected"), so the wallet never auto-connects. The classic `coinbaseWallet`
// connector reconnects cleanly there (eth_accounts, no prompt), which is what the
// platform app (viniapp.xyz) uses. Everything else mirrors the base template.
const { burnerWalletMode, targetNetworks } = scaffoldConfig as ScaffoldConfig;

const hasOnlyLocalTargetNetworks = targetNetworks.every(network => network.id === (chains.hardhat as chains.Chain).id);
const showBurnerWallet =
  burnerWalletMode !== "disabled" && (burnerWalletMode === "allNetworks" || hasOnlyLocalTargetNetworks);

const wallets = [
  metaMaskWallet,
  walletConnectWallet,
  ledgerWallet,
  coinbaseWallet,
  rainbowWallet,
  safeWallet,
  ...(showBurnerWallet ? [rainbowkitBurnerWallet] : []),
];

/**
 * wagmi connectors for the wagmi context
 */
export const wagmiConnectors = () => {
  // Only create connectors on client-side to avoid SSR issues
  // TODO: update when https://github.com/rainbow-me/rainbowkit/issues/2476 is resolved
  if (typeof window === "undefined") {
    return [];
  }

  return connectorsForWallets(
    [
      {
        groupName: "Supported Wallets",
        wallets,
      },
    ],

    {
      appName: "scaffold-eth-2",
      projectId: scaffoldConfig.walletConnectProjectId,
    },
  );
};
