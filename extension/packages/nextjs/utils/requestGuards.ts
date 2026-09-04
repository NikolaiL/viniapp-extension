import type { NextRequest } from "next/server";

/**
 * Request guards for the app's own beacon routes (`/api/track/*`).
 *
 * Those routes are unauthenticated by design — the browser posts to them and
 * the route attaches the server-only backend key — so instead of auth they get
 * a same-origin check (blocks cross-site pages from spamming the backend
 * through this app) and a best-effort per-IP rate limit.
 *
 * The rate limiter is in-memory and therefore PER INSTANCE: on Vercel every
 * warm lambda keeps its own buckets and a cold start resets them. Treat it as
 * a nuisance cap against a single misbehaving client, not a security boundary;
 * the ViniApp backend applies its own throttling on top.
 */

function hostOf(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Hosts this deployment answers to: the request host plus NEXT_PUBLIC_URL. */
function allowedHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase();
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (forwardedHost) hosts.add(forwardedHost);
  if (host) hosts.add(host);
  const configured = hostOf(process.env.NEXT_PUBLIC_URL);
  if (configured) hosts.add(configured);
  return hosts;
}

/**
 * True when the request comes from this app's own pages: `Sec-Fetch-Site` is
 * `same-origin`/`none`, or the `Origin` (else `Referer`) host matches the
 * request host / NEXT_PUBLIC_URL. Browsers always attach `Origin` to POSTs, so
 * older WebViews without Fetch Metadata still pass on the host comparison.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "same-origin" || fetchSite === "none") return true;

  const allowed = allowedHosts(request);
  const origin = hostOf(request.headers.get("origin"));
  if (origin) return allowed.has(origin);

  const referer = hostOf(request.headers.get("referer"));
  if (referer) return allowed.has(referer);

  return false;
}

/** True when the request declares a JSON body. */
export function isJsonRequest(request: NextRequest): boolean {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  return contentType === "application/json";
}

/** Best-effort client IP (first `X-Forwarded-For` hop, as set by the platform). */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

type Bucket = { tokens: number; updatedAt: number };

const MAX_TRACKED_KEYS = 5000;
const buckets = new Map<string, Map<string, Bucket>>();

/**
 * Continuously refilled token bucket: `limit` events per `windowMs` per key.
 * Returns false when the caller should be dropped. Per-instance memory only —
 * see the module comment.
 */
export function takeRateLimitToken(scope: string, key: string, limit: number, windowMs: number): boolean {
  let scopeBuckets = buckets.get(scope);
  if (!scopeBuckets) {
    scopeBuckets = new Map();
    buckets.set(scope, scopeBuckets);
  }

  const now = Date.now();
  let bucket = scopeBuckets.get(key);
  if (!bucket) {
    if (scopeBuckets.size >= MAX_TRACKED_KEYS) {
      // Bounded memory: evict the oldest-inserted key instead of growing forever.
      const oldest = scopeBuckets.keys().next().value;
      if (oldest !== undefined) scopeBuckets.delete(oldest);
    }
    bucket = { tokens: limit, updatedAt: now };
    scopeBuckets.set(key, bucket);
  }

  bucket.tokens = Math.min(limit, bucket.tokens + ((now - bucket.updatedAt) * limit) / windowMs);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) return false;

  bucket.tokens -= 1;
  return true;
}
