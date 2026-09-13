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
import type { FullMiniAppContext, SafeAreaInsets } from "~~/types/miniapp";
import {
  buildCaip19TokenId,
  buildFarcasterComposeUrl,
  buildTokenExplorerUrl,
  buildUniswapSwapUrl,
  parseFarcasterComposeUrl,
  toCastEmbeds,
} from "~~/utils/miniappLinks";
import { getQuickAuthToken } from "~~/utils/quickAuth";
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
 * - Safe areas: use the CSS variables `--safe-area-inset-*` / `.pt-safe` `.pb-safe`
 *   `.px-safe` (this provider bridges Farcaster and World App insets into them);
 *   never read SDK insets in components.
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
  /**
   * Ask the host to add the app (and enable notifications). Call it as the
   * FIRST statement of the handler for the user's first success (or an
   * explicit "Add" CTA with `{ force: true }`); it is a no-op outside
   * Farcaster, when already added, after a rejection this session, or when
   * NEXT_PUBLIC_AUTO_ADD_MINIAPP=false (unless forced).
   */
  promptAddMiniApp: (options?: { force?: boolean }) => Promise<boolean>;
  /**
   * Hold the add prompt while a run, round, or timed interaction is active:
   * `holdAddPrompt(true)` when it starts, `holdAddPrompt(false)` when it
   * ends. While held, the engagement fallback stays silent and
   * `promptAddMiniApp()` is a no-op unless forced, so the host sheet can
   * never open over live gameplay.
   */
  holdAddPrompt: (hold: boolean) => void;
}

const MiniappContext = createContext<MiniappContextType | undefined>(undefined);

/**
 * `sdk.actions.ready()` timing.
 *
 * The host shows its splash until ready() arrives, so the call decides what
 * the user sees first. Too early (on mount) and the splash gives way to a
 * shell that is still loading fonts, art, or the first data; too late and
 * the host looks stuck. The gate below releases ready() when every hold is
 * gone or after READY_CAP_MS, whichever comes first, so a slow or hung asset
 * can never keep the splash up. Holds are cheap and app-owned:
 *
 *   import { useReadyHold, configureReady } from "~~/components/MiniappProvider";
 *   useReadyHold(!atlasLoaded, "sprite-atlas");     // game: hold until art is in
 *   useReadyHold(accountQuery.isPending, "account"); // first screen's data
 *   configureReady({ disableNativeGestures: true }); // canvas games with drag
 *
 * Fire-and-forget: the SDK no-ops outside a Farcaster host; one short retry
 * covers a bridge that is not attached yet. Never throws, never rejects —
 * nothing may await it on Base App / plain web, where SDK promises can hang.
 */
const READY_CAP_MS = 3000;

export type ReadyOptions = { disableNativeGestures?: boolean };

const readyGate: {
  holds: Set<string>;
  released: boolean;
  options: ReadyOptions;
  listeners: Array<() => void>;
} = { holds: new Set(), released: false, options: {}, listeners: [] };

const releaseGate = () => {
  if (readyGate.released) return;
  readyGate.released = true;
  readyGate.listeners.splice(0).forEach(listener => listener());
};

/** Keep the host splash up until `releaseReady(reason)` (or the 3 s cap). */
export const holdReady = (reason: string) => {
  if (!readyGate.released) readyGate.holds.add(reason);
};

export const releaseReady = (reason: string) => {
  readyGate.holds.delete(reason);
  if (readyGate.holds.size === 0) releaseGate();
};

/** Options passed to ready(); call before the gate releases (first render). */
export const configureReady = (options: ReadyOptions) => {
  readyGate.options = { ...readyGate.options, ...options };
};

/** Hold ready() while `active` is true; releases on cleanup. */
export const useReadyHold = (active: boolean, reason: string) => {
  useEffect(() => {
    if (!active) return;
    holdReady(reason);
    return () => releaseReady(reason);
  }, [active, reason]);
};

const waitForReadyGate = (): Promise<void> =>
  new Promise(resolve => {
    if (readyGate.released || readyGate.holds.size === 0) {
      releaseGate();
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      releaseGate();
      resolve();
    }, READY_CAP_MS);
    readyGate.listeners.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });

const callReady = (): Promise<void> => {
  // Fonts are the one hold every app shares: a first frame in a fallback
  // face reflows the moment the web font lands.
  try {
    if (typeof document !== "undefined" && document.fonts?.status === "loading") {
      holdReady("fonts");
      document.fonts.ready.then(() => releaseReady("fonts")).catch(() => releaseReady("fonts"));
    }
  } catch {
    releaseReady("fonts");
  }
  return waitForReadyGate()
    .then(() => {
      try {
        return sdk.actions
          .ready(readyGate.options)
          .catch(async () => {
            await new Promise(resolve => setTimeout(resolve, 500));
            try {
              await sdk.actions.ready(readyGate.options);
            } catch (error) {
              console.error("MiniApp SDK ready() error:", error);
            }
          })
          .catch(() => {});
      } catch {
        return Promise.resolve();
      }
    })
    .catch(() => {});
};

/**
 * Add-mini-app prompt timing. The host allows the prompt only inside a user
 * gesture and remembers a rejection for the session, so asking on launch
 * (before the app has shown anything) burns the one chance on a "Not now".
 * Ask after the first success instead — the first score saved, entry written,
 * prediction placed — from that success handler. Never on launch.
 */
const ADD_PROMPT_ENGAGEMENT_MS = 45_000;

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

  // Safe-area bridge: raise the scaffold's --safe-area-inset-* CSS variables
  // to the host SDK's measured insets. Farcaster reports them in the SDK
  // context; World App injects window.WorldApp.safe_area_insets. Both are
  // combined with the OS env() value via max() so neither source is lost.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const hostInsets: Partial<SafeAreaInsets> | undefined =
      platform === "farcaster"
        ? context.client?.safeAreaInsets
        : platform === "worldapp"
          ? (window as unknown as { WorldApp?: { safe_area_insets?: Partial<SafeAreaInsets> } }).WorldApp
              ?.safe_area_insets
          : undefined;

    const style = document.documentElement.style;
    (["top", "right", "bottom", "left"] as const).forEach(side => {
      const env = `env(safe-area-inset-${side}, 0px)`;
      const host = hostInsets?.[side];
      style.setProperty(
        `--safe-area-inset-${side}`,
        typeof host === "number" && host > 0 ? `max(${env}, ${Math.round(host)}px)` : env,
      );
    });
  }, [platform, context.client?.safeAreaInsets]);

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
    // ready() first, unconditionally, in parallel with detection (see callReady).
    // Only the confirmed mini-app branch below awaits it, and only after
    // isReady is already set, so a hung host can never block initialization.
    const readyPromise = callReady();

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

      await new Promise(resolve => setTimeout(resolve, 100));

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
          connector = connectors.find(c => c.id === "farcasterMiniApp" || c.name?.toLowerCase().includes("farcaster"));
        } else if (platform === "worldapp") {
          connector =
            connectors.find(c => c.id === "worldApp" || c.name?.toLowerCase().includes("world")) ||
            connectors.find(c => c.id === "injected" || c.name?.toLowerCase().includes("injected"));
        } else {
          connector =
            connectors.find(c => c.id === "injected" || c.name?.toLowerCase().includes("injected")) || connectors[0];
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
        // Shared wrapper (utils/quickAuth.ts): the only place that calls
        // sdk.quickAuth.getToken(); app code reuses it for Bearer headers.
        getQuickAuthToken()
          .then(token => (token ? send({ fc_token: token }) : send()))
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

  // Add-mini-app prompt: once per session, never on launch (see the note above
  // ADD_PROMPT_ENGAGEMENT_MS). `NEXT_PUBLIC_AUTO_ADD_MINIAPP=false` turns the
  // automatic paths off; an explicit CTA still works with { force: true }.
  const addPromptDone = useRef(false);
  const addPromptHeld = useRef(false);
  const holdAddPrompt = (hold: boolean) => {
    addPromptHeld.current = hold;
  };
  const autoAddEnabled = process.env.NEXT_PUBLIC_AUTO_ADD_MINIAPP !== "false";
  const promptAddMiniApp = async (options?: { force?: boolean }): Promise<boolean> => {
    if (!isMiniApp || addPromptDone.current || context.client?.added) return false;
    if ((!autoAddEnabled || addPromptHeld.current) && !options?.force) return false;
    addPromptDone.current = true;
    try {
      // First awaited statement: the user-activation window is transient.
      await sdk.actions.addMiniApp();
      return true;
    } catch (error) {
      const name = (error as { name?: string } | null)?.name ?? "";
      if (name === "AddMiniApp.RejectedByUser") return false; // "Not now": do not ask again this session
      if (name === "AddMiniApp.InvalidDomainManifest")
        console.warn("addMiniApp: manifest domain mismatch (tunnel or preview domain?)");
      else console.warn("addMiniApp failed:", error);
      addPromptDone.current = false;
      return false;
    }
  };

  // Engagement fallback for apps without a clear first-success moment: after
  // 45 s of session time, the next tap prompts once. Skipped for notification
  // and cast-embed opens (those users came for one thing), while a run is held
  // (`holdAddPrompt(true)`), and for taps on a canvas or `[data-gameplay]`
  // surface: a gameplay tap must never open the host sheet (app 1466).
  useEffect(() => {
    if (!isReady || !isMiniApp || !autoAddEnabled || context.client?.added) return;
    const launch = context.location?.type;
    if (launch === "notification" || launch === "cast_embed") return;
    let armed = false;
    const timer = setTimeout(() => {
      armed = true;
    }, ADD_PROMPT_ENGAGEMENT_MS);
    const onGesture = (event: Event) => {
      if (!armed || addPromptDone.current || addPromptHeld.current) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("canvas, [data-gameplay]")) return;
      void promptAddMiniApp();
      document.removeEventListener("pointerup", onGesture, true);
    };
    document.addEventListener("pointerup", onGesture, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerup", onGesture, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, isMiniApp, autoAddEnabled, context.client?.added, context.location?.type]);

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
    promptAddMiniApp,
    holdAddPrompt,
  };

  return <MiniappContext.Provider value={value}>{children}</MiniappContext.Provider>;
};
