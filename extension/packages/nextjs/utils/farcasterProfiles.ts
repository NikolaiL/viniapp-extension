import "server-only";

/**
 * Farcaster profile lookup for leaderboards, activity feeds and anything that
 * lists other users. Uses Neynar's public, key-less author endpoint
 * (https://dev.neynar.com/api/neynar/author) so every app can show
 * `@username` + avatar instead of `Farcaster #1234` without owner credentials.
 *
 *   const profiles = await resolveFarcasterProfiles([1, 2, 3]);
 *   const label = profiles.get(fid)?.username ?? `#${fid}`;
 *
 * - Cached in memory for 5 minutes per fid (also caches misses).
 * - At most 5 concurrent lookups; larger lists are resolved in batches.
 * - Never throws: a failed lookup just yields no profile for that fid.
 */
export type FarcasterProfile = {
  fid: number;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
};

const AUTHOR_URL = "https://dev.neynar.com/api/neynar/author?identifier=";
const TTL_MS = 5 * 60 * 1000;
const CONCURRENCY = 5;
const TIMEOUT_MS = 4000;

const cache = new Map<number, { profile: FarcasterProfile | null; at: number }>();

async function fetchProfile(fid: number): Promise<FarcasterProfile | null> {
  try {
    const res = await fetch(AUTHOR_URL + fid, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { author?: Record<string, unknown> } | Record<string, unknown>;
    const author = ((body as { author?: Record<string, unknown> }).author ?? body) as Record<string, unknown>;
    if (!author || typeof author !== "object") return null;
    const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);
    return {
      fid,
      username: str(author.username),
      displayName: str(author.display_name) ?? str(author.displayName),
      pfpUrl: str(author.pfp_url) ?? str(author.pfpUrl) ?? str((author.pfp as { url?: unknown } | undefined)?.url),
    };
  } catch {
    return null;
  }
}

export async function resolveFarcasterProfile(fid: number): Promise<FarcasterProfile | null> {
  const hit = cache.get(fid);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.profile;
  const profile = await fetchProfile(fid);
  cache.set(fid, { profile, at: Date.now() });
  return profile;
}

export async function resolveFarcasterProfiles(fids: Iterable<number>): Promise<Map<number, FarcasterProfile>> {
  const unique = [...new Set([...fids].filter(fid => Number.isInteger(fid) && fid > 0))];
  const out = new Map<number, FarcasterProfile>();
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(resolveFarcasterProfile));
    results.forEach((profile, index) => {
      if (profile) out.set(batch[index], profile);
    });
  }
  return out;
}

/** Display label for a leaderboard row: @username, else display name, else the fallback. */
export function farcasterLabel(profile: FarcasterProfile | null | undefined, fallback: string): string {
  if (profile?.username) return `@${profile.username}`;
  if (profile?.displayName) return profile.displayName;
  return fallback;
}
