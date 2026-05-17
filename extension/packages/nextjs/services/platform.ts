"use client";

export type ViniPlatform = "farcaster" | "minipay" | "worldapp" | "web";

export type PlatformPaymentAsset = "APP_NATIVE" | "USDC" | "WLD" | "NONE";

export const PLATFORM_CHAIN_IDS: Record<Exclude<ViniPlatform, "web">, number> = {
  farcaster: 8453,
  minipay: 42220,
  worldapp: 480,
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
  if (isFarcasterMiniApp) return "farcaster";

  return "web";
};

export const targetChainForPlatform = (platform: ViniPlatform): number | undefined => {
  if (platform === "web") return undefined;
  return PLATFORM_CHAIN_IDS[platform];
};

export const paymentAssetForPlatform = (platform: ViniPlatform): PlatformPaymentAsset => {
  if (platform === "farcaster") return "APP_NATIVE";
  if (platform === "minipay") return "USDC";
  if (platform === "worldapp") return "WLD";
  return "NONE";
};

export const shouldShowAppNativeTokenLinks = (platform: ViniPlatform): boolean => {
  return platform !== "minipay" && platform !== "worldapp";
};

export const shareTargetForPlatform = (platform: ViniPlatform): "farcaster" | "x" | "web-share" => {
  if (platform === "farcaster") return "farcaster";
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
