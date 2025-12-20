"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

/**
 * Multi-platform provider for VINI apps
 * Supports: Farcaster, Base, Worldcoin, Telegram
 * 
 * Detection order:
 * 1. Telegram WebApp (checks window.Telegram)
 * 2. Worldcoin MiniKit (checks for World App user agent or MiniKit)
 * 3. Farcaster/Base (uses @farcaster/miniapp-sdk)
 */

export type Platform = "farcaster" | "base" | "worldcoin" | "telegram" | "web";

export interface PlatformUser {
  // Common fields
  id: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  
  // Platform-specific
  fid?: number; // Farcaster
  worldId?: string; // Worldcoin
  telegramId?: number; // Telegram
}

export interface PlatformContext {
  platform: Platform;
  user: PlatformUser | null;
  isReady: boolean;
  isInApp: boolean;
  
  // Farcaster/Base specific
  clientFid?: number;
  
  // Worldcoin specific
  isVerified?: boolean;
  
  // Telegram specific
  initData?: string;
}

interface PlatformProviderContextType {
  context: PlatformContext;
  
  // Common actions
  openLink: (url: string) => Promise<void>;
  shareContent: (text: string, url?: string) => Promise<void>;
  
  // Platform-specific methods available
  farcaster?: {
    composeCast: (params: { text: string; embeds?: string[] }) => Promise<void>;
    openProfile: (params: { fid?: number; username?: string }) => Promise<void>;
  };
  
  worldcoin?: {
    verify: () => Promise<{ success: boolean; proof?: string }>;
  };
  
  telegram?: {
    sendData: (data: string) => void;
    showAlert: (message: string) => Promise<void>;
    showConfirm: (message: string) => Promise<boolean>;
  };
}

const PlatformProviderContext = createContext<PlatformProviderContextType | undefined>(undefined);

export const usePlatform = () => {
  const ctx = useContext(PlatformProviderContext);
  if (ctx === undefined) {
    throw new Error("usePlatform must be used within a PlatformProvider");
  }
  return ctx;
};

interface PlatformProviderProps {
  children: ReactNode;
  // Optional: specify which platforms to try (in order)
  enabledPlatforms?: Platform[];
}

/**
 * Known Client FIDs for Farcaster ecosystem
 */
const KNOWN_CLIENT_FIDS: Record<number, Platform> = {
  9152: "farcaster", // Warpcast
  309857: "base", // Base App
};

export const PlatformProvider = ({ 
  children, 
  enabledPlatforms = ["telegram", "worldcoin", "base", "farcaster"] 
}: PlatformProviderProps) => {
  const [context, setContext] = useState<PlatformContext>({
    platform: "web",
    user: null,
    isReady: false,
    isInApp: false,
  });

  // Platform-specific handlers
  const [farcasterSdk, setFarcasterSdk] = useState<any>(null);
  const [telegramWebApp, setTelegramWebApp] = useState<any>(null);

  useEffect(() => {
    const detectAndInitialize = async () => {
      // 1. Check for Telegram WebApp
      if (enabledPlatforms.includes("telegram") && typeof window !== "undefined") {
        const telegram = (window as any).Telegram?.WebApp;
        if (telegram && telegram.initData) {
          console.log("[Platform] Detected Telegram WebApp");
          setTelegramWebApp(telegram);
          
          telegram.ready();
          telegram.expand();
          
          const user = telegram.initDataUnsafe?.user;
          setContext({
            platform: "telegram",
            user: user ? {
              id: String(user.id),
              username: user.username,
              displayName: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
              avatarUrl: user.photo_url,
              telegramId: user.id,
            } : null,
            isReady: true,
            isInApp: true,
            initData: telegram.initData,
          });
          return;
        }
      }

      // 2. Check for Worldcoin MiniKit
      if (enabledPlatforms.includes("worldcoin") && typeof window !== "undefined") {
        // Check for World App user agent or MiniKit presence
        const isWorldApp = navigator.userAgent.includes("WorldApp") || 
                          !!(window as any).MiniKit;
        
        if (isWorldApp) {
          console.log("[Platform] Detected World App");
          try {
            const MiniKit = (await import("@worldcoin/minikit-js")).MiniKit;
            await MiniKit.install();
            
            setContext({
              platform: "worldcoin",
              user: null, // User set after verification
              isReady: true,
              isInApp: true,
              isVerified: false,
            });
            return;
          } catch (err) {
            console.warn("[Platform] MiniKit not available:", err);
          }
        }
      }

      // 3. Check for Farcaster/Base
      if (enabledPlatforms.includes("farcaster") || enabledPlatforms.includes("base")) {
        try {
          const { sdk } = await import("@farcaster/miniapp-sdk");
          setFarcasterSdk(sdk);
          
          await sdk.actions.ready();
          const sdkContext = await sdk.context;
          const inMiniApp = await sdk.isInMiniApp();

          if (inMiniApp && sdkContext) {
            // Determine if Farcaster or Base based on clientFid
            const clientFid = sdkContext.client?.clientFid;
            const detectedPlatform = clientFid ? (KNOWN_CLIENT_FIDS[clientFid] || "farcaster") : "farcaster";
            
            console.log(`[Platform] Detected ${detectedPlatform} (clientFid: ${clientFid})`);
            
            setContext({
              platform: detectedPlatform,
              user: sdkContext.user ? {
                id: String(sdkContext.user.fid),
                username: sdkContext.user.username,
                displayName: sdkContext.user.displayName,
                avatarUrl: sdkContext.user.pfpUrl,
                fid: sdkContext.user.fid,
              } : null,
              isReady: true,
              isInApp: true,
              clientFid,
            });
            return;
          }
        } catch (err) {
          console.warn("[Platform] Farcaster SDK not available:", err);
        }
      }

      // 4. Fallback to web
      console.log("[Platform] No platform detected, using web fallback");
      setContext({
        platform: "web",
        user: null,
        isReady: true,
        isInApp: false,
      });
    };

    detectAndInitialize();
  }, [enabledPlatforms]);

  // Common action: Open Link
  const openLink = async (url: string) => {
    switch (context.platform) {
      case "farcaster":
      case "base":
        if (farcasterSdk) {
          try {
            await farcasterSdk.actions.openUrl(url);
            return;
          } catch (err) {
            console.error("openLink error:", err);
          }
        }
        break;
      case "telegram":
        if (telegramWebApp) {
          telegramWebApp.openLink(url);
          return;
        }
        break;
    }
    // Fallback
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  };

  // Common action: Share Content
  const shareContent = async (text: string, url?: string) => {
    const fullText = url ? `${text}\n\n${url}` : text;
    
    switch (context.platform) {
      case "farcaster":
      case "base":
        if (farcasterSdk) {
          try {
            const embeds = url ? [url] : [];
            await farcasterSdk.actions.composeCast({ text, embeds });
            return;
          } catch (err) {
            console.error("composeCast error:", err);
          }
        }
        break;
      case "telegram":
        if (telegramWebApp) {
          // Telegram doesn't have a direct share, open in browser
          const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url || "")}&text=${encodeURIComponent(text)}`;
          telegramWebApp.openLink(shareUrl);
          return;
        }
        break;
    }
    // Fallback: copy to clipboard
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(fullText);
    }
  };

  // Farcaster-specific methods
  const farcaster = (context.platform === "farcaster" || context.platform === "base") && farcasterSdk ? {
    composeCast: async ({ text, embeds = [] }: { text: string; embeds?: string[] }) => {
      const trimmed = embeds.filter(Boolean).slice(0, 2);
      const embedsTuple = ((): [] | [string] | [string, string] => {
        if (trimmed.length >= 2) return [trimmed[0], trimmed[1]] as [string, string];
        if (trimmed.length === 1) return [trimmed[0]] as [string];
        return [] as [];
      })();
      await farcasterSdk.actions.composeCast({ text, embeds: embedsTuple });
    },
    openProfile: async (params: { fid?: number; username?: string }) => {
      if (context.isInApp) {
        await farcasterSdk.actions.viewProfile(params);
      } else if (params.fid) {
        window.open(`https://farcaster.xyz/~/profiles/${params.fid}`, "_blank");
      } else if (params.username) {
        window.open(`https://farcaster.xyz/${params.username}`, "_blank");
      }
    },
  } : undefined;

  // Worldcoin-specific methods
  const worldcoin = context.platform === "worldcoin" ? {
    verify: async () => {
      try {
        const { MiniKit, VerificationLevel } = await import("@worldcoin/minikit-js");
        const result = await MiniKit.commandsAsync.verify({
          action: "verify-human",
          verification_level: VerificationLevel.Orb,
        });
        
        if (result.finalPayload) {
          setContext(prev => ({
            ...prev,
            isVerified: true,
            user: prev.user ? { ...prev.user, worldId: result.finalPayload.nullifier_hash } : {
              id: result.finalPayload.nullifier_hash,
              worldId: result.finalPayload.nullifier_hash,
            },
          }));
          return { success: true, proof: JSON.stringify(result.finalPayload) };
        }
        return { success: false };
      } catch (err) {
        console.error("World ID verification error:", err);
        return { success: false };
      }
    },
  } : undefined;

  // Telegram-specific methods
  const telegram = context.platform === "telegram" && telegramWebApp ? {
    sendData: (data: string) => telegramWebApp.sendData(data),
    showAlert: (message: string) => new Promise<void>(resolve => {
      telegramWebApp.showAlert(message, resolve);
    }),
    showConfirm: (message: string) => new Promise<boolean>(resolve => {
      telegramWebApp.showConfirm(message, resolve);
    }),
  } : undefined;

  const value: PlatformProviderContextType = {
    context,
    openLink,
    shareContent,
    farcaster,
    worldcoin,
    telegram,
  };

  return (
    <PlatformProviderContext.Provider value={value}>
      {children}
    </PlatformProviderContext.Provider>
  );
};

/**
 * Hook to get platform-specific UI elements
 */
export const usePlatformUI = () => {
  const { context } = usePlatform();
  
  return {
    // Platform badge/label
    platformLabel: {
      farcaster: "Farcaster",
      base: "Base",
      worldcoin: "World App",
      telegram: "Telegram",
      web: "Web",
    }[context.platform],
    
    // Platform colors (for theming)
    platformColor: {
      farcaster: "#8B5CF6", // Purple
      base: "#0052FF", // Blue
      worldcoin: "#000000", // Black
      telegram: "#0088CC", // Telegram blue
      web: "#6B7280", // Gray
    }[context.platform],
    
    // Platform icon emoji
    platformIcon: {
      farcaster: "🟣",
      base: "🔵",
      worldcoin: "🌍",
      telegram: "✈️",
      web: "🌐",
    }[context.platform],
  };
};
