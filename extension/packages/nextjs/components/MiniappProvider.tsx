"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { base } from "viem/chains";
import { useAccount, useConnect, useReconnect, useSwitchChain } from "wagmi";
import {
  type ViniPlatform,
  detectViniPlatform,
  openXShare,
  shouldShowAppNativeTokenLinks,
  targetChainForPlatform,
} from "~~/services/platform";
import type { FullMiniAppContext } from "~~/types/miniapp";
import {
  buildCaip19TokenId,
  buildFarcasterComposeUrl,
  buildTokenExplorerUrl,
  buildUniswapSwapUrl,
  parseFarcasterComposeUrl,
  toCastEmbeds,
} from "~~/utils/miniappLinks";
import { installClientErrorReporting } from "~~/utils/reportClientError";

export type {
  AccountLocation,
  ClientContext,
  ClientFeatures,
  FullMiniAppContext,
  LocationContext,
  MiniAppCast,
  MiniAppNotificationDetails,
  MiniAppPlatformType,
  SafeAreaInsets,
  User,
} from "~~/types/miniapp";
export { resolveClientFid } from "~~/types/miniapp";

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
  isMiniPay: boolean;
  isWorldApp: boolean;
  platform: ViniPlatform;
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
  const [platform, setPlatform] = useState<ViniPlatform>("web");
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const { reconnect } = useReconnect();
  // One-shot guard so the open/track event fires exactly once per mount.
  const trackingFired = useRef(false);

  useEffect(() => installClientErrorReporting(), []);
  // One-shot guard so wallet auto-connect runs once per mount and does not
  // re-fire on every wagmi connectors/isConnected change (first-load flicker).
  const autoConnectAttempted = useRef(false);

  const composeCast = async ({ text, embeds = [] }: { text: string; embeds?: string[] }) => {
    try {
      const farcasterAttribution = "@viniapp";
      const castText = text.includes(farcasterAttribution) ? text : `${text}\n\ncreated with ${farcasterAttribution}`;

      if (platform === "minipay" || platform === "worldapp") {
        openXShare({ text, url: embeds[0] || process.env.NEXT_PUBLIC_URL });
        return;
      }

      if (isMiniApp) {
        const embedsTuple = toCastEmbeds(embeds);
        console.log("composeCast processing", castText, embedsTuple);
        await sdk.actions.composeCast({ text: castText, embeds: embedsTuple });

        return;
      }
      if (typeof window !== "undefined") window.open(buildFarcasterComposeUrl(castText, embeds), "_blank");
    } catch (err) {
      console.error("composeCast error", err);
    }
  };

  const openLink = async (url: string) => {
    try {
      const composeRequest = parseFarcasterComposeUrl(
        url,
        typeof window !== "undefined" ? window.location.href : "https://local",
      );
      if (composeRequest) {
        await composeCast(composeRequest);
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
      if (!shouldShowAppNativeTokenLinks(platform)) return;

      const caip19 = buildCaip19TokenId(tokenAddress, chain);
      if (isMiniApp) {
        await (sdk.actions as any).viewToken({ token: caip19 });
        return;
      }
      // Fallback: open on basescan (or appropriate explorer)
      if (typeof window !== "undefined") window.open(buildTokenExplorerUrl(tokenAddress, chain), "_blank");
    } catch (err) {
      console.error("viewToken error", err);
      if (typeof window !== "undefined") {
        window.open(buildTokenExplorerUrl(tokenAddress), "_blank");
      }
    }
  };

  /**
   * Open the swap interface in the Farcaster client.
   * @param params.buyToken - Token address to buy
   * @param params.sellToken - Token address to sell
   * @param params.chain - Chain identifier (default: "8453" for Base)
   */
  const swapToken = async ({
    buyToken,
    sellToken,
    chain = "8453",
  }: {
    buyToken?: string;
    sellToken?: string;
    chain?: string;
  }) => {
    try {
      if (platform === "minipay") {
        if (typeof window !== "undefined") window.open("https://minipay.opera.com/add_cash", "_blank");
        return;
      }

      if (platform === "worldapp") {
        console.warn("Use the app's World App WLD payment flow instead of a generic app-token swap.");
        return;
      }

      if (isMiniApp) {
        const swapParams: Record<string, string> = {};
        if (buyToken) swapParams.buyToken = buildCaip19TokenId(buyToken, chain);
        if (sellToken) swapParams.sellToken = buildCaip19TokenId(sellToken, chain);
        await (sdk.actions as any).swapToken(swapParams);
        return;
      }
      // Fallback: open Uniswap
      const tokenAddr = buyToken || sellToken || "";
      if (typeof window !== "undefined") window.open(buildUniswapSwapUrl(tokenAddr), "_blank");
    } catch (err) {
      console.error("swapToken error", err);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        // Provider-first: detect injected-provider hosts (Base App, MiniPay, World
        // App) synchronously from window signals — no Farcaster SDK needed. The Base
        // App has no FC SDK, so awaiting sdk.isInMiniApp()/sdk.context there would
        // stall; resolve those hosts immediately so platform + isReady are never
        // blocked by a hanging SDK call.
        const providerPlatform = detectViniPlatform(false);
        if (providerPlatform !== "web") {
          setIsMiniApp(false);
          setPlatform(providerPlatform);
          setIsReady(true);
          return;
        }

        // No injected-provider signal: a genuine Farcaster mini app or plain web.
        let inMiniApp = false;
        try {
          inMiniApp = await Promise.race([
            sdk.isInMiniApp(),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000)),
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

        const readyPromise = sdk.actions.ready().catch((error) => {
          console.error("MiniApp SDK ready() error:", error);
        });
        const sdkContext = await sdk.context;

        const fullContext: FullMiniAppContext = {
          user: sdkContext?.user ?? null,
          location: sdkContext?.location,
          client: sdkContext?.client,
          features: sdkContext?.features,
        };

        setContext(fullContext);
        setIsMiniApp(true);
        setPlatform(detectViniPlatform(true));
        setIsReady(true);
        await readyPromise;

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

  // Auto-connect embedded wallets when the host exposes one (Farcaster mini-app,
  // Base App / Coinbase / MiniPay / World App in-app browsers). Runs once per
  // mount — guarding the unstable wagmi deps prevents first-load flicker.
  useEffect(() => {
    if (!isReady || platform === "web" || autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;

    const autoConnect = async () => {
      try {
        await reconnect();
      } catch (e) {
        console.log("Reconnect attempt:", e);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // For the Base App, reconnect() above is the ONLY auto-connect step. Do NOT
      // call connect(): reconnect() is wagmi's fire-and-forget mutate (still in
      // flight here), so an explicit connect() races it and corrupts wagmi into a
      // stuck status="connecting" in the Base App. Returning users restore silently
      // via reconnect(); first-time users tap the Connect button. Other hosts
      // (Farcaster, MiniPay, World App) keep the explicit-connect fallback.
      if (!isConnected && platform !== "base") {
        const targetChainId = targetChainForPlatform(platform);
        // Farcaster mini-apps use the frame connector; World App uses the
        // MiniKit-backed worldApp connector; MiniPay (and any other injected host)
        // uses the standard injected provider.
        let connector;
        if (platform === "farcaster") {
          connector = connectors.find(
            (c) => c.id === "farcasterMiniApp" || c.name?.toLowerCase().includes("farcaster"),
          );
        } else if (platform === "worldapp") {
          connector =
            connectors.find((c) => c.id === "worldApp" || c.name?.toLowerCase().includes("world")) ||
            connectors.find((c) => c.id === "injected" || c.name?.toLowerCase().includes("injected"));
        } else {
          connector =
            connectors.find((c) => c.id === "injected" || c.name?.toLowerCase().includes("injected")) || connectors[0];
        }

        if (connector) {
          try {
            connect({ connector, chainId: targetChainId || base.id });
          } catch (e) {
            console.error("Auto-connect error:", e);
          }
        }
      }
    };

    autoConnect();
    // One-shot via ref; reads latest connectors/isConnected at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, platform]);

  // Switch embedded wallets to the platform's default chain when possible.
  useEffect(() => {
    const targetChainId = targetChainForPlatform(platform);
    if (isConnected && chainId && targetChainId && chainId !== targetChainId && platform !== "web") {
      try {
        switchChain({ chainId: targetChainId });
      } catch (e) {
        console.error("Chain switch error:", e);
      }
    }
  }, [isConnected, chainId, switchChain, platform]);

  // Fire the open/track event exactly once, and only after user identity has
  // resolved. The wallet auto-connect (and Farcaster wallet attach) lands a beat
  // AFTER `isReady`, so firing on `isReady` alone would record a premature
  // anonymous open and then a duplicate once the address arrives. Instead we
  // wait for a wallet address (the universal identifier) and fall back to a
  // single anonymous event only once a grace window confirms no wallet is
  // connecting — so logged-out web visitors are still counted exactly once.
  useEffect(() => {
    if (!isReady || trackingFired.current) return;

    const fire = () => {
      if (trackingFired.current) return;
      trackingFired.current = true;
      const trackingPayload: Record<string, unknown> = {
        platform,
        page_url: typeof window !== "undefined" ? window.location.href : undefined,
        fid: context.user?.fid,
        username: context.user?.username,
        wallet_address: address?.toLowerCase(),
        client_fid: context.client?.clientFid ? String(context.client.clientFid) : undefined,
      };
      const send = (extra?: Record<string, unknown>) =>
        fetch("/api/track/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(extra ? { ...trackingPayload, ...extra } : trackingPayload),
        }).catch(() => {});
      if (isMiniApp) {
        sdk.quickAuth
          .getToken()
          .then(({ token }) => send({ fc_token: token }))
          .catch(() => send());
      } else {
        send();
      }
    };

    // Wallet present → fire now with full identity. This also re-runs (and fires)
    // the moment auto-connect delivers the address.
    if (address) {
      fire();
      return;
    }

    // No wallet yet. Wallet platforms auto-connect, so wait longer for the
    // address; plain web has no auto-connect, so a short window is enough before
    // recording a single anonymous (or fid-only) open event.
    const grace = platform === "web" ? 1500 : 4000;
    const timer = setTimeout(fire, grace);
    return () => clearTimeout(timer);
  }, [isReady, platform, address, isMiniApp, context.user?.fid, context.user?.username, context.client?.clientFid]);

  const value = {
    context,
    isReady,
    isMiniApp,
    isMiniPay: platform === "minipay",
    isWorldApp: platform === "worldapp",
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
