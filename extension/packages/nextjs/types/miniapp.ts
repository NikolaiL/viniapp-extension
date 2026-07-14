/** Farcaster SDK context types shared by the provider and app components. */
export type SafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type MiniAppNotificationDetails = { url: string; token: string };
export type MiniAppPlatformType = "web" | "mobile";
export type AccountLocation = { placeId: string; description: string };

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
  | {
      type: "notification";
      notification: { notificationId: string; title: string; body: string };
    }
  | { type: "launcher" }
  | {
      type: "channel";
      channel: { key: string; name: string; imageUrl?: string };
    }
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

const KNOWN_CLIENT_FIDS: Readonly<Record<number, string>> = {
  9152: "Warpcast",
  309857: "Base App",
};

export function resolveClientFid(fid: number | undefined): string {
  if (!fid) return "Unknown";
  return KNOWN_CLIENT_FIDS[fid] || `Unknown Client (${fid})`;
}
