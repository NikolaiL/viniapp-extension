export const metadataOverrides = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "ViniApp",
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || "A cross-platform onchain app",
};

// Mini apps render edge-to-edge inside Farcaster/Base/World hosts. Without
// viewport-fit=cover the safe-area insets resolve to 0 and fixed headers or
// bottom navs sit under notches. The platform's release invariant requires it.
// Pinch-zoom stays enabled app-wide for accessibility; a game route exports its
// own `viewport` with maximumScale 1 / userScalable false (see the
// miniapp-game-patterns skill) so double-tap zoom cannot fire during play.
export const preContent = `export const viewport: import("next").Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
`;
