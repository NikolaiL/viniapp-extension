import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "App Preview";
export const contentType = "image/png";
export const size = { width: 1200, height: 800 };
export const revalidate = 600;

async function loadGoogleFont(font: string) {
  const url = `https://fonts.googleapis.com/css2?family=${font}`;
  const css = await (await fetch(url)).text();
  const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);

  if (resource) {
    const response = await fetch(resource[1]);
    if (response.status == 200) {
      return await response.arrayBuffer();
    }
  }

  throw new Error("failed to load font data");
}

export default async function Image() {
  // Try to serve cover.png first (the preferred static OG image)
  try {
    const coverPath = join(process.cwd(), "public", "cover.png");
    const coverBuffer = await readFile(coverPath);

    return new Response(new Uint8Array(coverBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=600, s-maxage=600",
      },
    });
  } catch {
    // cover.png not found — fall back to auto-generated image
  }

  // Generate a simple branded image with the app name
  try {
    const appName = process.env.NEXT_PUBLIC_APP_NAME || process.env.NEXT_PUBLIC_APP_OG_TITLE || "ViniApp";
    const tagline = process.env.NEXT_PUBLIC_APP_TAGLINE || process.env.NEXT_PUBLIC_APP_SUBTITLE || "";
    const bgColor = process.env.NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR || "#212638";

    let fonts;
    try {
      fonts = [
        { name: "Inter", data: await loadGoogleFont("Inter:wght@700") },
        { name: "InterLight", data: await loadGoogleFont("Inter:wght@400") },
      ];
    } catch {
      fonts = undefined;
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bgColor,
            fontFamily: fonts ? "Inter, sans-serif" : "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              fontWeight: "700",
              color: "#ffffff",
              textAlign: "center",
              lineHeight: "1.2",
              maxWidth: "900px",
              padding: "0 40px",
            }}
          >
            {appName}
          </div>
          {tagline && (
            <div
              style={{
                fontSize: "32px",
                fontWeight: "400",
                color: "rgba(255, 255, 255, 0.6)",
                marginTop: "24px",
                textAlign: "center",
                maxWidth: "800px",
                fontFamily: fonts ? "InterLight, sans-serif" : "system-ui, sans-serif",
              }}
            >
              {tagline}
            </div>
          )}
          <div
            style={{
              position: "absolute",
              bottom: "40px",
              fontSize: "24px",
              color: "rgba(255, 255, 255, 0.3)",
            }}
          >
            Built on @viniapp
          </div>
        </div>
      ),
      {
        ...size,
        ...(fonts ? { fonts } : {}),
      },
    );
  } catch {
    // If everything fails, return a minimal response
    throw new Error("Failed to generate OG image and no cover.png found");
  }
}
