import { Attribution } from "ox/erc8021";

const DEFAULT_BUILDER_CODE = "bc_41su3c2k";

/**
 * Resolve the builder code for ERC-8021 transaction attribution.
 * Server preference: BUILDER_CODE > NEXT_PUBLIC_BUILDER_CODE > default.
 * Client (browser) only sees NEXT_PUBLIC_BUILDER_CODE; falls back to default.
 */
export function getBuilderCode(): string {
  const serverCode = typeof process !== "undefined" ? process.env.BUILDER_CODE?.trim() : undefined;
  const publicCode = process.env.NEXT_PUBLIC_BUILDER_CODE?.trim();
  return serverCode || publicCode || DEFAULT_BUILDER_CODE;
}

/**
 * ERC-8021 dataSuffix derived from the resolved builder code. Append to
 * any wagmi/viem writeContract or sendTransaction call to attribute it.
 */
export function getBuilderCodeDataSuffix(): `0x${string}` {
  return Attribution.toDataSuffix({ codes: [getBuilderCode()] });
}

export const builderCodeDataSuffix: `0x${string}` = getBuilderCodeDataSuffix();
