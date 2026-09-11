"use client";

import { sdk } from "@farcaster/miniapp-sdk";

/**
 * The ONE client-side wrapper for Farcaster Quick Auth (AGENTS.md: route every
 * `sdk.quickAuth.getToken()` call through it). Inside a Farcaster mini app the
 * Quick Auth token IS the user's identity for saving their own data: send it
 * as `Authorization: Bearer` and let the server (`utils/farcasterIdentity.ts`)
 * verify it and resolve the wallet from the fid. Do not ask Farcaster users
 * for a wallet signature to save scores, progress, or point purchases; the
 * wallet-signature session is the fallback for plain web / Base App users
 * who have no fid.
 *
 *   const headers = await quickAuthHeaders();       // {} outside Farcaster
 *   await fetch("/api/game/run", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body });
 */

let inFlight: Promise<{ token: string }> | null = null;
let lastToken: { token: string; at: number } | null = null;
const TOKEN_REUSE_MS = 60 * 1000;

/** Whether a Quick Auth request from this wrapper is currently in flight (for the unhandledrejection guard). */
export function isQuickAuthInFlight(): boolean {
  return inFlight !== null;
}

/**
 * Quick Auth token, or null when unavailable (not a mini app, SDK without
 * quickAuth, user declined). Coalesces concurrent calls and reuses a token for
 * a minute so a burst of requests does not prompt the client repeatedly.
 */
export async function getQuickAuthToken(): Promise<string | null> {
  if (lastToken && Date.now() - lastToken.at < TOKEN_REUSE_MS) return lastToken.token;
  try {
    if (!(await sdk.isInMiniApp())) return null;
    const quickAuth = (sdk as { quickAuth?: { getToken: () => Promise<{ token: string }> } }).quickAuth;
    if (!quickAuth) return null;
    inFlight ??= quickAuth.getToken().finally(() => {
      inFlight = null;
    });
    const { token } = await inFlight;
    lastToken = { token, at: Date.now() };
    return token;
  } catch {
    return null;
  }
}

/** Forget the reused token (call on a 401 from a protected route, then retry once). */
export function invalidateQuickAuthToken(): void {
  lastToken = null;
}

/** `{ Authorization: "Bearer <jwt>" }` inside a Farcaster mini app, `{}` elsewhere. */
export async function quickAuthHeaders(): Promise<Record<string, string>> {
  const token = await getQuickAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
