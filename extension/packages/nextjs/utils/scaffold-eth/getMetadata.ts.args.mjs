// Reference the example args file: https://github.com/scaffold-eth/create-eth-extensions/blob/example/extension/packages/nextjs/app/utils/scaffold-eth/getMetadata.ts.args.mjs
// Reference the template file that will use this file: https://github.com/scaffold-eth/create-eth/blob/main/templates/base/packages/nextjs/app/utils/scaffold-eth/getMetadata.ts.template.mjs

// Default args:
export const preContent = `
const EMBED_LIMITS = { BUTTON_TITLE: 32, ACTION_NAME: 32, URL: 1024 } as const;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return max > 1 ? str.slice(0, max - 1) + "…" : str.slice(0, max);
}

function clampUrl(url: string, max: number = EMBED_LIMITS.URL): string {
  if (url.length <= max) return url;
  console.warn(\`[fc:miniapp] URL exceeds \${max} char limit (\${url.length}): \${url.slice(0, 80)}…\`);
  return url.slice(0, max);
}

function buildMiniappEmbed(
  imageUrl: string,
  imageRelativePath: string,
  title: string,
  baseUrl: string,
  actionName?: string,
  actionRelativeUrl?: string,
): string {
  const miniappBaseUrl = getMiniappBaseUrl(baseUrl);
  const miniappImageUrl = getMiniappImageUrl(baseUrl, imageRelativePath);
  const miniappActionUrl = actionRelativeUrl
    ? new URL(actionRelativeUrl, miniappBaseUrl).toString()
    : miniappBaseUrl;
  const buttonTitle = truncate(actionName || process.env.NEXT_PUBLIC_APP_NAME || title, EMBED_LIMITS.BUTTON_TITLE);
  const appName = truncate(actionName || title || process.env.NEXT_PUBLIC_APP_NAME || "", EMBED_LIMITS.ACTION_NAME);
  return JSON.stringify({
    version: "1",
    imageUrl: clampUrl(miniappImageUrl || imageUrl || process.env.NEXT_PUBLIC_IMAGE_URL || ""),
    button: {
      title: buttonTitle,
      action: {
        url: clampUrl(miniappActionUrl),
        type: "launch_miniapp",
        name: appName,
        splashImageUrl: process.env.NEXT_PUBLIC_APP_SPLASH_IMAGE || new URL("/favicon.png", miniappBaseUrl).toString(),
        splashBackgroundColor: process.env.NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR || "#212638",
      },
    },
  });
}

function getMiniappBaseUrl(baseUrl: string): string {
  return process.env.NEXT_PUBLIC_URL || baseUrl;
}

function getMiniappImageUrl(baseUrl: string, imageRelativePath: string): string {
  return new URL(imageRelativePath, getMiniappBaseUrl(baseUrl)).toString();
}
`

// export const metadataOverrides = {
//   other: {
//     "fc:miniapp": `$$JSON.stringify({'a': 'b'})$$`,
//   },
// };

export const metadataOverrides = {
  metadataBase: '$$new URL(getMiniappBaseUrl(baseUrl))$$',
  openGraph: {
    images: [
      {
        url: '$$getMiniappImageUrl(baseUrl, imageRelativePath)$$',
      },
    ],
  },
  twitter: {
    images: ['$$getMiniappImageUrl(baseUrl, imageRelativePath)$$'],
  },
  other: {
    "fc:miniapp": `$$buildMiniappEmbed(imageUrl, imageRelativePath, title, baseUrl)$$`,
  },
};

export const titleTemplate = "%s | Scaffold-ETH 2 + MiniApp";


export const thumbnailPath = "/opengraph-image";

