import "server-only";

/**
 * Server-side ViniApp identity for user-owned persistence (scores, progress,
 * purchases with earned points, settings).
 *
 * Inside a Farcaster mini app the DEFAULT identity is the Farcaster Quick Auth
 * JWT: the client sends `Authorization: Bearer <token>` (see
 * `utils/quickAuth.ts`), this module verifies it and resolves the user's
 * primary Ethereum address from the fid — first from the ViniApp Snapchain hub
 * (`USER_DATA_PRIMARY_ADDRESS_ETHEREUM`, then the newest verified address),
 * then from Neynar when `NEYNAR_API_KEY` is set. Never ask a Farcaster user for
 * a wallet signature just to save their data.
 *
 * Outside Farcaster (plain web, Base App without a fid) the app falls back to a
 * wallet-signature challenge; that path is app code, this module only tells you
 * that no Farcaster identity was presented (`source: "none"`).
 *
 *   const identity = await resolveMiniappIdentity(request);
 *   if (identity.source === "quickauth") {
 *     // identity.fid is verified; identity.address is the fid's primary wallet
 *     // (null only when the fid has no Ethereum address anywhere).
 *   }
 */

export type MiniappIdentity =
  | { source: "quickauth"; fid: number; address: `0x${string}` | null; addressSource: "hub-primary" | "hub-verification" | "neynar" | null }
  | { source: "none"; fid: null; address: null; addressSource: null };

const HUB_URL = (process.env.FARCASTER_HUB_URL || "http://65.21.162.140:3381").replace(/\/+$/, "");
const HUB_TIMEOUT_MS = 4000;
const ADDRESS_CACHE_TTL_MS = 10 * 60 * 1000;

const addressCache = new Map<number, { address: `0x${string}` | null; source: MiniappIdentity["addressSource"]; at: number }>();

function quickAuthDomain(): string {
  const explicit = process.env.NEXT_PUBLIC_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).hostname;
    } catch {
      /* fall through */
    }
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return vercelUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return "localhost";
}

async function hubGet(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(HUB_URL + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`hub ${path} -> ${response.status}`);
  return response.json();
}

const isAddress = (value: unknown): value is `0x${string}` => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);

/** Primary Ethereum address the user chose in Farcaster, if any. */
async function hubPrimaryAddress(fid: number): Promise<`0x${string}` | null> {
  const data = (await hubGet("/v1/userDataByFid", { fid: String(fid) })) as {
    messages?: { data?: { userDataBody?: { type?: string; value?: string } } }[];
  };
  for (const message of data.messages ?? []) {
    const body = message.data?.userDataBody;
    if (body?.type === "USER_DATA_PRIMARY_ADDRESS_ETHEREUM" && isAddress(body.value)) return body.value;
  }
  return null;
}

/** Newest verified (connected) Ethereum address on the fid. */
async function hubVerifiedAddress(fid: number): Promise<`0x${string}` | null> {
  const data = (await hubGet("/v1/verificationsByFid", { fid: String(fid), pageSize: "50" })) as {
    messages?: { data?: { timestamp?: number; verificationAddAddressBody?: { address?: string; protocol?: string } } }[];
  };
  let best: { address: `0x${string}`; timestamp: number } | null = null;
  for (const message of data.messages ?? []) {
    const body = message.data?.verificationAddAddressBody;
    const timestamp = message.data?.timestamp ?? 0;
    if (body?.protocol === "PROTOCOL_ETHEREUM" && isAddress(body.address) && (!best || timestamp > best.timestamp)) {
      best = { address: body.address, timestamp };
    }
  }
  return best?.address ?? null;
}

async function neynarAddress(fid: number): Promise<`0x${string}` | null> {
  const key = process.env.NEYNAR_API_KEY?.trim();
  if (!key) return null;
  const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
    headers: { accept: "application/json", "x-api-key": key },
    signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    users?: { verified_addresses?: { primary?: { eth_address?: string }; eth_addresses?: string[] }; custody_address?: string }[];
  };
  const user = data.users?.[0];
  const candidates = [user?.verified_addresses?.primary?.eth_address, ...(user?.verified_addresses?.eth_addresses ?? []), user?.custody_address];
  const found = candidates.find(isAddress);
  return found ?? null;
}

/**
 * Resolve the wallet that represents a fid, lower-cased. Cached per fid for
 * ten minutes so a leaderboard write does not hit the hub on every request.
 */
export async function resolveFidAddress(fid: number): Promise<{ address: `0x${string}` | null; source: MiniappIdentity["addressSource"] }> {
  const cached = addressCache.get(fid);
  if (cached && Date.now() - cached.at < ADDRESS_CACHE_TTL_MS) return { address: cached.address, source: cached.source };

  const attempts: [MiniappIdentity["addressSource"], () => Promise<`0x${string}` | null>][] = [
    ["hub-primary", () => hubPrimaryAddress(fid)],
    ["hub-verification", () => hubVerifiedAddress(fid)],
    ["neynar", () => neynarAddress(fid)],
  ];
  let result: { address: `0x${string}` | null; source: MiniappIdentity["addressSource"] } = { address: null, source: null };
  for (const [source, attempt] of attempts) {
    try {
      const address = await attempt();
      if (address) {
        result = { address: address.toLowerCase() as `0x${string}`, source };
        break;
      }
    } catch {
      // Hub or Neynar unavailable: try the next source; a fid with no
      // resolvable wallet is still a valid Farcaster identity.
    }
  }
  if (result.address) addressCache.set(fid, { ...result, at: Date.now() });
  return result;
}

/** Verify a Farcaster Quick Auth JWT for this app's domain; returns the fid or null. */
export async function verifyQuickAuthToken(token: string): Promise<number | null> {
  if (!token || token.length > 8192) return null;
  try {
    const { createClient } = await import("@farcaster/quick-auth");
    const payload = await createClient().verifyJwt({ token, domain: quickAuthDomain() });
    const fid = typeof payload.sub === "string" ? parseInt(payload.sub, 10) : Number(payload.sub);
    return Number.isSafeInteger(fid) && fid > 0 ? fid : null;
  } catch {
    return null;
  }
}

/**
 * Identity for a request: Quick Auth bearer token when present and valid,
 * otherwise `source: "none"` (the caller decides whether a wallet-signature
 * session or guest mode applies). A bearer token that fails verification is
 * treated as absent, never as a different identity.
 */
export async function resolveMiniappIdentity(request: Request): Promise<MiniappIdentity> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { source: "none", fid: null, address: null, addressSource: null };

  const fid = await verifyQuickAuthToken(token);
  if (!fid) return { source: "none", fid: null, address: null, addressSource: null };

  const { address, source } = await resolveFidAddress(fid);
  return { source: "quickauth", fid, address, addressSource: source };
}
