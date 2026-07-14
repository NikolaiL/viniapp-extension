export type CastEmbeds = [] | [string] | [string, string];

export interface FarcasterComposeRequest {
  text: string;
  embeds: string[];
}

export function toCastEmbeds(embeds: string[]): CastEmbeds {
  const trimmed = embeds.filter(Boolean).slice(0, 2);
  if (trimmed.length >= 2) return [trimmed[0], trimmed[1]];
  if (trimmed.length === 1) return [trimmed[0]];
  return [];
}

export function parseFarcasterComposeUrl(url: string, baseUrl = "https://local"): FarcasterComposeRequest | null {
  const parsed = new URL(url, baseUrl);
  const hostname = parsed.hostname.toLowerCase();
  const isFarcasterHost =
    hostname === "warpcast.com" ||
    hostname.endsWith(".warpcast.com") ||
    hostname === "farcaster.xyz" ||
    hostname.endsWith(".farcaster.xyz");

  if (!isFarcasterHost || parsed.pathname !== "/~/compose") return null;

  return {
    text: (parsed.searchParams.get("text") ?? "").replace(/\+/g, " "),
    embeds: parsed.searchParams.getAll("embeds[]"),
  };
}

export function buildFarcasterComposeUrl(text: string, embeds: string[]): string {
  const url = new URL("https://farcaster.xyz/~/compose");
  url.searchParams.set("text", text);
  for (const embed of embeds.filter(Boolean)) url.searchParams.append("embeds[]", embed);
  return url.toString();
}

export function buildCaip19TokenId(tokenAddress: string, chain = "8453"): string {
  return `eip155:${chain}/erc20:${tokenAddress}`;
}

export function buildTokenExplorerUrl(tokenAddress: string, chain = "8453"): string {
  return chain === "8453" ? `https://basescan.org/token/${tokenAddress}` : `https://etherscan.io/token/${tokenAddress}`;
}

export function buildUniswapSwapUrl(tokenAddress: string): string {
  const url = new URL("https://app.uniswap.org/swap");
  url.searchParams.set("chain", "base");
  url.searchParams.set("outputCurrency", tokenAddress);
  return url.toString();
}
