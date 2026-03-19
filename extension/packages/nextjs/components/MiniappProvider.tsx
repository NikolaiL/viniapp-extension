"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount } from "wagmi";

/**
 * Full Farcaster SDK context types
 * Based on: https://miniapps.farcaster.xyz/docs/sdk/context
 */
export type SafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type MiniAppNotificationDetails = {
  url: string;
  token: string;
};

export type MiniAppPlatformType = "web" | "mobile";

export type AccountLocation = {
  placeId: string;
  description: string;
};

export type User = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  location?: AccountLocation;
};

export type MiniAppCast = {
  author: User;
  hash: string;
  parentHash?: string;
  parentFid?: number;
  timestamp?: number;
  mentions?: User[];
  text: string;
  embeds?: string[];
  channelKey?: string;
};

export type LocationContext =
  | { type: "cast_embed"; embed: string; cast: MiniAppCast }
  | { type: "cast_share"; cast: MiniAppCast }
  | { type: "notification"; notification: { notificationId: string; title: string; body: string } }
  | { type: "launcher" }
  | { type: "channel"; channel: { key: string; name: string; imageUrl?: string } }
  | { type: "open_miniapp"; referrerDomain: string };

export type ClientContext = {
  platformType?: MiniAppPlatformType;
  clientFid: number;
  added: boolean;
  safeAreaInsets?: SafeAreaInsets;
  notificationDetails?: MiniAppNotificationDetails;
};

export type ClientFeatures = {
  haptics: boolean;
  cameraAndMicrophoneAccess?: boolean;
};

export type FullMiniAppContext = {
  user: User | null;
  location?: LocationContext;
  client?: ClientContext;
  features?: ClientFeatures;
};

/**
 * Known Client FIDs
 * Map of client FIDs to their display names
 */
const KNOWN_CLIENT_FIDS: Record<number, string> = {
  9152: "Warpcast",
  309857: "Base App",
};

/**
 * Resolve a client FID to its display name
 * @param fid - The client FID to resolve
 * @returns The client name if known, otherwise "Unknown Client"
 */
export const resolveClientFid = (fid: number | undefined): string => {
  if (!fid) return "Unknown";
  return KNOWN_CLIENT_FIDS[fid] || `Unknown Client (${fid})`;
};

/**
 * MiniappContext provides full SDK context and initialization state
 *
 * Usage:
 * - Access all context: const { context, isReady, isMiniApp } = useMiniapp()
 * - Access user: context.user
 * - Check launch context: if (context.location?.type === 'cast_embed') { ... }
 * - Use safe area insets: context.client?.safeAreaInsets
 * - Check features: if (context.features?.haptics) { ... }
 * - Helper functions: openLink(), composeCast(), openProfile()
 * - For SDK methods: import { sdk } from "@farcaster/miniapp-sdk" and use directly
 *   Example: await sdk.quickAuth.getToken()
 */
interface MiniappContextType {
  context: FullMiniAppContext;
  isReady: boolean;
  isMiniApp: boolean;
  platform: "farcaster" | "web";
  walletAddress: string | undefined;
  openLink: (url: string) => Promise<void>;
  composeCast: (params: { text: string; embeds?: string[] }) => Promise<void>;
  openProfile: (params: { fid?: number; username?: string }) => Promise<void>;
  viewToken: (tokenAddress: string, chain?: string) => Promise<void>;
  swapToken: (params: { buyToken?: string; sellToken?: string; chain?: string }) => Promise<void>;
}

const MiniappContext = createContext<MiniappContextType | undefined>(undefined);

/**
 * Hook to access Farcaster miniapp context
 * Provides full SDK context, user data, and initialization state
 *
 * @returns {{ context: FullMiniAppContext, isReady: boolean, isMiniApp: boolean }}
 * @throws Error if used outside of MiniappProvider
 */
export const useMiniapp = () => {
  const ctx = useContext(MiniappContext);
  if (ctx === undefined) {
    throw new Error("useMiniapp must be used within a MiniappProvider");
  }
  return ctx;
};

interface MiniappProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that initializes the Farcaster miniapp SDK
 * Handles sdk.actions.ready() call and stores full SDK context
 */
export const MiniappProvider = ({ children }: MiniappProviderProps) => {
  const [context, setContext] = useState<FullMiniAppContext>({ user: null });
  const [isReady, setIsReady] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [platform, setPlatform] = useState<"farcaster" | "web">("web");
  const { address } = useAccount();

  const composeCast = async ({ text, embeds = [] }: { text: string; embeds?: string[] }) => {
    try {
      if (isMiniApp) {
        const trimmed = embeds.filter(Boolean).slice(0, 2);
        const embedsTuple = ((): [] | [string] | [string, string] => {
          if (trimmed.length >= 2) return [trimmed[0], trimmed[1]] as [string, string];
          if (trimmed.length === 1) return [trimmed[0]] as [string];
          return [] as [];
        })();
        console.log("composeCast processing", text, embedsTuple);
        await sdk.actions.composeCast({ text, embeds: embedsTuple });

        return;
      }
      const url = new URL("https://farcaster.xyz/~/compose");
      url.searchParams.set("text", text);
      for (const e of embeds) url.searchParams.append("embeds[]", e);
      if (typeof window !== "undefined") window.open(url.toString(), "_blank");
    } catch (err) {
      console.error("composeCast error", err);
    }
  };

  const openLink = async (url: string) => {
    try {
      // Detect compose URLs (warpcast.com or farcaster.xyz)
      const parsed = new URL(url, typeof window !== "undefined" ? window.location.href : "https://local");
      const hostname = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname;
      const isCompose =
        (hostname.includes("warpcast.com") || hostname.includes("farcaster.xyz")) && pathname === "/~/compose";

      if (isCompose) {
        const textParam = parsed.searchParams.get("text") || "";
        // URLSearchParams decodes automatically; replace "+" with space just in case
        const text = textParam.replace(/\+/g, " ");
        const embeds = parsed.searchParams.getAll("embeds[]");
        await composeCast({ text, embeds });
        return;
      }

      const inMiniApp = await sdk.isInMiniApp();
      if (inMiniApp) {
        await sdk.actions.openUrl(url);
      } else if (typeof window !== "undefined") {
        window.open(url, "_blank");
      }
    } catch (err) {
      console.error("openLink error", err);
      if (typeof window !== "undefined") window.open(url, "_blank");
    }
  };

  const openProfile = async (params: { fid?: number; username?: string }) => {
    try {
      const inMiniApp = await sdk.isInMiniApp();
      if (inMiniApp) {
        await sdk.actions.viewProfile(params as any);
        return;
      }
      if (params?.fid) {
        if (typeof window !== "undefined") window.open(`https://farcaster.xyz/~/profiles/${params.fid}`, "_blank");
      } else if (params?.username) {
        if (typeof window !== "undefined") window.open(`https://farcaster.xyz/${params.username}`, "_blank");
      }
    } catch (err) {
      console.error("openProfile error", err);
      if (params?.fid && typeof window !== "undefined") {
        window.open(`https://farcaster.xyz/~/profiles/${params.fid}`, "_blank");
      }
    }
  };

  /**
   * View a token in the Farcaster client.
   * Uses CAIP-19 format: eip155:{chainId}/erc20:{address}
   * @param tokenAddress - The token contract address
   * @param chain - Chain identifier (default: "8453" for Base)
   */
  const viewToken = async (tokenAddress: string, chain: string = "8453") => {
    try {
      const caip19 = `eip155:${chain}/erc20:${tokenAddress}`;
      if (isMiniApp) {
        await (sdk.actions as any).viewToken({ token: caip19 });
        return;
      }
      // Fallback: open on basescan (or appropriate explorer)
      const explorerUrl = chain === "8453"
        ? `https://basescan.org/token/${tokenAddress}`
        : `https://etherscan.io/token/${tokenAddress}`;
      if (typeof window !== "undefined") window.open(explorerUrl, "_blank");
    } catch (err) {
      console.error("viewToken error", err);
      if (typeof window !== "undefined") {
        window.open(`https://basescan.org/token/${tokenAddress}`, "_blank");
      }
    }
  };

  /**
   * Open the swap interface in the Farcaster client.
   * @param params.buyToken - Token address to buy
   * @param params.sellToken - Token address to sell
   * @param params.chain - Chain identifier (default: "8453" for Base)
   */
  const swapToken = async ({ buyToken, sellToken, chain = "8453" }: { buyToken?: string; sellToken?: string; chain?: string }) => {
    try {
      const buildCaip19 = (addr: string) => `eip155:${chain}/erc20:${addr}`;
      if (isMiniApp) {
        const swapParams: Record<string, string> = {};
        if (buyToken) swapParams.buyToken = buildCaip19(buyToken);
        if (sellToken) swapParams.sellToken = buildCaip19(sellToken);
        await (sdk.actions as any).swapToken(swapParams);
        return;
      }
      // Fallback: open Uniswap
      const tokenAddr = buyToken || sellToken || "";
      const uniswapUrl = `https://app.uniswap.org/swap?chain=base&outputCurrency=${tokenAddr}`;
      if (typeof window !== "undefined") window.open(uniswapUrl, "_blank");
    } catch (err) {
      console.error("swapToken error", err);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        let inMiniApp = false;
        try {
          inMiniApp = await Promise.race([
            sdk.isInMiniApp(),
            new Promise<boolean>(resolve => setTimeout(() => resolve(false), 1000)),
          ]);
        } catch {
          inMiniApp = false;
        }

        if (!inMiniApp) {
          setIsMiniApp(false);
          setPlatform("web");
          setIsReady(true);
          return;
        }

        await sdk.actions.ready();

        const sdkContext = await sdk.context;

        const fullContext: FullMiniAppContext = {
          user: sdkContext?.user ?? null,
          location: sdkContext?.location,
          client: sdkContext?.client,
          features: sdkContext?.features,
        };

        console.log("MiniApp SDK ready");

        setContext(fullContext);
        setIsMiniApp(true);
        setPlatform("farcaster");
        setIsReady(true);

        const added = fullContext.client?.added ?? false;
        const autoAdd = process.env.NEXT_PUBLIC_AUTO_ADD_MINIAPP !== "false";
        if (!added && autoAdd) {
          try {
            await sdk.actions.addMiniApp();
          } catch (e) {
            console.log("Error adding mini app:", e);
          }
        }
      } catch (error) {
        console.error("MiniApp SDK initialization error:", error);
        setIsReady(true);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    try {
      const trackingPayload: Record<string, unknown> = {
        platform,
        page_url: typeof window !== "undefined" ? window.location.href : undefined,
        fid: context.user?.fid,
        username: context.user?.username,
        wallet_address: address?.toLowerCase(),
        client_fid: context.client?.clientFid ? String(context.client.clientFid) : undefined,
      };
      if (isMiniApp) {
        (async () => {
          try {
            const { token } = await sdk.quickAuth.getToken();
            trackingPayload.fc_token = token;
          } catch {
            /* token not available */
          }
          fetch("/api/track/open", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trackingPayload),
          }).catch(() => {});
        })();
      } else {
        fetch("/api/track/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trackingPayload),
        }).catch(() => {});
      }
    } catch {
      /* tracking should never block the app */
    }
  }, [isReady, platform, address]);

  const value = {
    context,
    isReady,
    isMiniApp,
    platform,
    walletAddress: address?.toLowerCase(),
    openLink,
    composeCast,
    openProfile,
    viewToken,
    swapToken,
  };

  return <MiniappContext.Provider value={value}>{children}</MiniappContext.Provider>;
};
