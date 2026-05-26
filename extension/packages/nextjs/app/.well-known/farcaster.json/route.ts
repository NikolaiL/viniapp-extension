type ManifestValue = string | string[] | Record<string, unknown>;

const VALID_CATEGORIES = new Set([
  "games",
  "social",
  "finance",
  "utility",
  "productivity",
  "health-fitness",
  "news-media",
  "music",
  "shopping",
  "education",
  "developer-tools",
  "entertainment",
  "art-creativity",
]);

function withValidProperties<T extends Record<string, ManifestValue | undefined>>(properties: T) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
      return !!value;
    }),
  );
}

function getBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

function absoluteUrl(value: string | undefined, baseUrl: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function clamp(value: string | undefined, max: number) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max).trim() : trimmed;
}

function manifestText(value: string | undefined, max: number) {
  const normalized = value
    ?.replace(/[@#$%^&*+=\/\\|~«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return clamp(normalized, max);
}

function csv(input: string | undefined): string[] {
  return (input || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function manifestTags(input: string | undefined) {
  return csv(input)
    .map(tag => tag.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 20))
    .filter(Boolean)
    .slice(0, 5);
}

function screenshotUrls(input: string | undefined, baseUrl: string) {
  return csv(input)
    .map(url => absoluteUrl(url, baseUrl))
    .filter((url): url is string => Boolean(url))
    .slice(0, 3);
}

function category(input: string | undefined) {
  const value = input?.trim();
  return value && VALID_CATEGORIES.has(value) ? value : undefined;
}

function accountAssociation() {
  const header = process.env.FARCASTER_HEADER?.trim();
  const payload = process.env.FARCASTER_PAYLOAD?.trim();
  const signature = process.env.FARCASTER_SIGNATURE?.trim();

  if (!header || !payload || !signature || header === "header" || payload === "payload" || signature === "signature") {
    return undefined;
  }

  return { header, payload, signature };
}

export async function GET() {
  const baseUrl = getBaseUrl();
  const appName = clamp(process.env.NEXT_PUBLIC_APP_NAME, 32) || "ViniApp";

  const frame = withValidProperties({
    version: "1",
    name: appName,
    subtitle: manifestText(process.env.NEXT_PUBLIC_APP_SUBTITLE, 30),
    description: manifestText(process.env.NEXT_PUBLIC_APP_DESCRIPTION, 170),
    iconUrl: absoluteUrl(process.env.NEXT_PUBLIC_APP_ICON || "/icon.png", baseUrl),
    splashImageUrl: absoluteUrl(process.env.NEXT_PUBLIC_APP_SPLASH_IMAGE || "/splash.png", baseUrl),
    splashBackgroundColor: process.env.NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR,
    homeUrl: baseUrl,
    screenshotUrls: screenshotUrls(process.env.NEXT_PUBLIC_APP_SCREENSHOTS, baseUrl),
    webhookUrl: absoluteUrl(process.env.NEXT_PUBLIC_WEBHOOK_URL || "/api/webhook", baseUrl),
    primaryCategory: category(process.env.NEXT_PUBLIC_APP_PRIMARY_CATEGORY),
    tags: manifestTags(process.env.NEXT_PUBLIC_APP_TAGS),
    heroImageUrl: absoluteUrl(process.env.NEXT_PUBLIC_APP_HERO_IMAGE, baseUrl),
    tagline: manifestText(process.env.NEXT_PUBLIC_APP_TAGLINE, 30),
    ogTitle: manifestText(process.env.NEXT_PUBLIC_APP_OG_TITLE, 30),
    ogDescription: manifestText(process.env.NEXT_PUBLIC_APP_OG_DESCRIPTION, 100),
    ogImageUrl: absoluteUrl(process.env.NEXT_PUBLIC_APP_OG_IMAGE, baseUrl),
  });

  return Response.json(
    withValidProperties({
      accountAssociation: accountAssociation(),
      frame,
    }),
  );
}
