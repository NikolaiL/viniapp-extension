import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { createPublicClient, http, parseAbiItem } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import scaffoldConfig from "~~/scaffold.config";

export const runtime = "nodejs";
export const alt = "Greetings";

/**
 * Image settings for the opengraph image
 * Keep the size at 1200x800px
 * If you need to add or change fonts, add them to the fonts array
 * and update the fontFamily in the style props of the elements
 */
export const imageSettings = {
  width: 1200,
  height: 800,
  fonts: [
    {
      name: "RubikBlack",
      data: await loadGoogleFont("Rubik:wght@800"),
    },
    {
      name: "Rubik",
      data: await loadGoogleFont("Rubik:wght@300;400;700;800"),
    },
    {
      name: "RubikBold",
      data: await loadGoogleFont("Rubik:wght@700"),
    },
    {
      name: "RubikLight",
      data: await loadGoogleFont("Rubik:wght@300"),
    },
    {
      name: "NotoSansBold",
      data: await loadGoogleFont("Noto+Sans+Mono:wght@700"),
    },
  ],
};
export const contentType = "image/png";
export const revalidate = 600; // Revalidate every 10 minutes

type Greeting = {
  text: string;
  setterId: `0x${string}`;
  premium: boolean;
  value: bigint;
};

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

async function getLatestGreeting(): Promise<Greeting | null> {
  try {
    const targetNetwork = scaffoldConfig.targetNetworks[0];
    const contractData = deployedContracts[targetNetwork.id as keyof typeof deployedContracts]?.YourContract;

    if (!contractData) {
      console.error("Contract not deployed on target network");
      return null;
    }

    const publicClient = createPublicClient({
      chain: targetNetwork,
      transport: http(),
    });

    // Fetch GreetingChange events
    const logs = await publicClient.getLogs({
      address: contractData.address as `0x${string}`,
      event: parseAbiItem(
        "event GreetingChange(address indexed greetingSetter, string newGreeting, bool premium, uint256 value)",
      ),
      fromBlock: "earliest",
      toBlock: "latest",
    });

    if (!logs || logs.length === 0) {
      return null;
    }

    // Get the latest log (last in array)
    const latestLog = logs[logs.length - 1];

    return {
      text: latestLog.args.newGreeting || "",
      setterId: (latestLog.args.greetingSetter || "0x0") as `0x${string}`,
      premium: latestLog.args.premium || false,
      value: latestLog.args.value || BigInt(0),
    };
  } catch (error) {
    console.error("Error fetching greeting from contract:", error);
    return null;
  }
}

function formatAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default async function Image() {
  const greeting = await getLatestGreeting();

  // If no greeting found or no connection to Ponder, return static thumbnail
  if (!greeting) {
    try {
      const publicDir = join(process.cwd(), "public");
      const thumbnailPath = join(publicDir, "thumbnail_miniapp.jpg");
      const thumbnailBuffer = await readFile(thumbnailPath);

      return new NextResponse(new Uint8Array(thumbnailBuffer), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=600, s-maxage=600",
        },
      });
    } catch (error) {
      console.error("Error reading thumbnail file:", error);
      // If thumbnail can't be read, throw error
      throw new Error("No greeting available and thumbnail file not found");
    }
  }

  // Generate dynamic image with greeting data
  const greetingText = greeting.text;
  const walletAddress = greeting.setterId;
  const isPremium = greeting.premium;
  // Success color from global.css
  const successColor = "#34eeb6";
  const borderColor = isPremium ? successColor : "#DDDDDD"; // gray if not premium, green if premium

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
          backgroundColor: "#FAFBFF",
          fontFamily: "Rubik, sans-serif",
          gap: "30px",
        }}
      >
        {/* Top: from address - outside the div, centered */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "36px",
            color: "#212639",
          }}
        >
          <span>Greeting by</span>
          <span
            style={{
              color: "#60a5fa",
              fontFamily: "RubikBlack, sans-serif",
              fontWeight: "800",
            }}
          >
            {formatAddress(walletAddress)}
          </span>
        </div>

        {/* Main container: 1100 x 500 with border */}
        <div
          style={{
            width: "1100px",
            height: "500px",
            display: "flex",
            flexDirection: "column",
            border: `4px solid ${borderColor}`,
            borderRadius: "36px",
            backgroundColor: "#ffffff",
            padding: "10px",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Greeting text */}
          <div
            style={{
              fontSize: "64px",
              fontWeight: "bold",
              color: "#212639",
              lineHeight: "1.2",
              width: "100%",
              textAlign: "center",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textOverflow: "ellipsis",
              margin: "0 auto",
            }}
          >
            {greetingText}
          </div>
        </div>

        {/* Bottom: Title - outside the div, centered */}
        <div
          style={{
            display: "flex",
            marginTop: "60px",
            alignItems: "center",
            fontSize: "48px",
            color: "#212639",
            fontFamily: "NotoSansBold, system-ui, -apple-system, sans-serif",
          }}
        >
          Scaffold-ETH 2 + MiniApp Extension
        </div>
      </div>
    ),
    {
      ...imageSettings,
    },
  );
}
