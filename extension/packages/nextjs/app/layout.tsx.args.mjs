export const metadataOverrides = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "ViniApp",
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || "A cross-platform onchain app",
};

// Mini apps render edge-to-edge inside Farcaster/Base/World hosts. Without
// viewport-fit=cover the safe-area insets resolve to 0 and fixed headers or
// bottom navs sit under notches. The platform's release invariant requires it.
export const preContent = `export const viewport: import("next").Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
`;
