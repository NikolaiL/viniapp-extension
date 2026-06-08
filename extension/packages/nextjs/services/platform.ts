"use client";

export type ViniPlatform = "farcaster" | "base" | "minipay" | "worldapp" | "web";

export type PlatformPaymentAsset = "APP_NATIVE" | "USDC" | "WLD" | "NONE";

export const PLATFORM_CHAIN_IDS: Record<Exclude<ViniPlatform, "web">, number> = {
  farcaster: 8453,
  base: 8453,
  minipay: 42220,
  worldapp: 480,
};

/**
 * Detect the Base App in-app browser.
 *
 * As of the April 2026 migration, the Base App is a standard web app + wallet
 * (no Farcaster `context.client`), so it is identified the same way MiniPay and
 * World App are — via the injected provider. The Coinbase/Base in-app browser
 * exposes `isCoinbaseBrowser` (the precise in-app signal) and `isCoinbaseWallet`
 * on the EIP-1193 provider (also surfaced under `providers[]` when several
 * wallets inject themselves).
 */
const isBaseAppRuntime = (): boolean => {
  if (typeof window === "undefined") return false;
  const eth = (window as any).ethereum;
  if (!eth) return false;
  const looksLikeBase = (p: any) => !!(p && (p.isCoinbaseBrowser || p.isCoinbaseWallet));
  if (looksLikeBase(eth)) return true;
  if (Array.isArray(eth.providers)) return eth.providers.some(looksLikeBase);
  return false;
};

export const detectViniPlatform = (isFarcasterMiniApp = false): ViniPlatform => {
  if (typeof window === "undefined") return "web";

  const w = window as typeof window & {
    ethereum?: { isMiniPay?: boolean };
    WorldApp?: unknown;
    MiniKit?: unknown;
  };

  if (w.WorldApp || w.MiniKit) return "worldapp";
  if (w.ethereum?.isMiniPay || /MiniPay|Opera Mini/i.test(navigator.userAgent)) return "minipay";
  // Base App check MUST come before the Farcaster check. The Base App is a
  // mini-app host, so `sdk.isInMiniApp()` returns true there too — but it is a
  // Base App, not a Farcaster client. Its injected Coinbase provider
  // (`isCoinbaseBrowser`/`isCoinbaseWallet`) is a precise signal that Warpcast and
  // other genuine Farcaster clients never set, so detecting it first keeps Base
  // App opens out of the "farcaster" bucket.
  if (isBaseAppRuntime()) return "base";
  if (isFarcasterMiniApp) return "farcaster";

  return "web";
};

export const targetChainForPlatform = (platform: ViniPlatform): number | undefined => {
  if (platform === "web") return undefined;
  return PLATFORM_CHAIN_IDS[platform];
};

export const paymentAssetForPlatform = (platform: ViniPlatform): PlatformPaymentAsset => {
  if (platform === "farcaster" || platform === "base") return "APP_NATIVE";
  if (platform === "minipay") return "USDC";
  if (platform === "worldapp") return "WLD";
  return "NONE";
};

export const shouldShowAppNativeTokenLinks = (platform: ViniPlatform): boolean => {
  return platform !== "minipay" && platform !== "worldapp";
};

export const shareTargetForPlatform = (platform: ViniPlatform): "farcaster" | "x" | "web-share" => {
  if (platform === "farcaster" || platform === "base") return "farcaster";
  if (platform === "minipay" || platform === "worldapp") return "x";
  return "web-share";
};

export const buildXShareUrl = ({ text, url }: { text: string; url?: string }) => {
  const xUrl = new URL("https://twitter.com/intent/tweet");
  const attribution = "@viniapp_xyz";
  const shareText = text.includes(attribution) ? text : `${text}\n\ncreated with ${attribution}`;
  xUrl.searchParams.set("text", shareText);
  if (url) xUrl.searchParams.set("url", url);
  return xUrl.toString();
};

export const openXShare = ({ text, url }: { text: string; url?: string }) => {
  if (typeof window === "undefined") return;
  window.open(buildXShareUrl({ text, url }), "_blank", "noopener,noreferrer");
};
