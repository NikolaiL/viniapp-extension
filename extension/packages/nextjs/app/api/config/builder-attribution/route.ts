import { NextResponse } from "next/server";
import { Attribution } from "ox/erc8021";

export const runtime = "nodejs";

const DEFAULT_BUILDER_CODE = "bc_41su3c2k";

/**
 * Runtime builder code for ERC-8021 transaction dataSuffix.
 * Prefer BUILDER_CODE (server-only, no rebuild needed on Vercel) over
 * NEXT_PUBLIC_BUILDER_CODE (inlined into the client bundle at build time).
 * Falls back to the platform default so transactions are always attributed.
 */
export async function GET() {
  const code =
    process.env.BUILDER_CODE?.trim() || process.env.NEXT_PUBLIC_BUILDER_CODE?.trim() || DEFAULT_BUILDER_CODE;

  const dataSuffix = Attribution.toDataSuffix({ codes: [code] });

  return NextResponse.json({ code, dataSuffix }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
