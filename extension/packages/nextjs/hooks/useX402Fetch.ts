import { useCallback, useMemo } from "react";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { base } from "viem/chains";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

/**
 * The x402 library sets `Access-Control-Expose-Headers` as a request header
 * on payment retries (a response-only header). Servers that don't whitelist it
 * in `Access-Control-Allow-Headers` will reject the CORS preflight.
 * This wrapper strips it before the request reaches the browser.
 */
const corsSafeFetch: typeof globalThis.fetch = (input, init) => {
  if (input instanceof Request) {
    input.headers.delete("Access-Control-Expose-Headers");
  }
  return globalThis.fetch(input, init);
};

/**
 * Custom hook that provides an x402-enabled fetch function.
 *
 * Wraps the standard fetch API with x402 payment capabilities.
 * When an endpoint returns 402, the wrapper automatically parses
 * payment requirements, prompts the wallet for a signature, and
 * retries with the payment proof.
 */
export function useX402Fetch() {
  const { address } = useAccount();
  const { data: walletClient, isLoading: isWalletLoading } = useWalletClient();
  // The app's configured Base client (RPC overrides / fallbacks / polling from
  // wagmiConfig) rather than a bare `createPublicClient({ transport: http() })`
  // that would hammer the public default RPC. Undefined only if Base is not in
  // the app's wagmi chains, in which case x402 on Base is unavailable anyway.
  const publicClient = usePublicClient({ chainId: base.id });

  const { fetchWithPayment, isReady } = useMemo(() => {
    if (!walletClient || !address || !publicClient) {
      return { fetchWithPayment: null, isReady: false };
    }

    try {
      const signer = toClientEvmSigner(
        {
          address: address as `0x${string}`,
          signTypedData: (args: Parameters<typeof walletClient.signTypedData>[0]) => walletClient.signTypedData(args),
        },
        publicClient,
      );

      const wrappedFetch = wrapFetchWithPaymentFromConfig(corsSafeFetch, {
        schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer) }],
      });

      return { fetchWithPayment: wrappedFetch, isReady: true };
    } catch (error) {
      console.error("Failed to initialize x402 client:", error);
      return { fetchWithPayment: null, isReady: false };
    }
  }, [walletClient, address, publicClient]);

  const safeFetchWithPayment = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (!fetchWithPayment) {
        throw new Error("Wallet not connected. Please connect your wallet to make x402 requests.");
      }
      return fetchWithPayment(input, init);
    },
    [fetchWithPayment],
  );

  return {
    fetchWithPayment: safeFetchWithPayment,
    isReady,
    isLoading: isWalletLoading,
  };
}
