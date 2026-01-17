import { useCallback, useMemo } from "react";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { useAccount, useWalletClient } from "wagmi";

/**
 * Custom hook that provides an x402-enabled fetch function.
 *
 * This hook wraps the standard fetch API with x402 payment capabilities:
 * 1. Makes a request to an x402 endpoint
 * 2. If the endpoint returns 402 Payment Required, automatically:
 *    - Parses the payment requirements (price, asset, recipient)
 *    - Prompts the user to sign the payment via their connected wallet
 *    - Retries the request with the payment proof
 * 3. Returns the successful response
 *
 * @returns Object containing:
 *   - fetchWithPayment: The x402-wrapped fetch function
 *   - isReady: Boolean indicating if the wallet is connected and hook is ready
 *   - error: Any initialization error
 *
 * @example
 * ```tsx
 * const { fetchWithPayment, isReady } = useX402Fetch();
 *
 * const response = await fetchWithPayment("https://api.example.com/paid-endpoint", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ data: "value" }),
 * });
 * ```
 */
export function useX402Fetch() {
  const { address } = useAccount();
  const { data: walletClient, isLoading: isWalletLoading } = useWalletClient();

  // Create the x402 client and wrapped fetch function
  const { fetchWithPayment, isReady } = useMemo(() => {
    if (!walletClient || !address) {
      return {
        fetchWithPayment: null,
        isReady: false,
      };
    }

    try {
      // Initialize x402 client
      const client = new x402Client();

      // Create a signer object that includes the address and wallet client methods
      // The x402 EVM scheme requires an address property on the signer
      const signer = {
        ...walletClient,
        address: address as `0x${string}`,
      };

      // Register the EVM payment scheme with the connected wallet
      registerExactEvmScheme(client, { signer });

      // Wrap fetch with payment capabilities
      const wrappedFetch = wrapFetchWithPayment(fetch, client);

      return {
        fetchWithPayment: wrappedFetch,
        isReady: true,
      };
    } catch (error) {
      console.error("Failed to initialize x402 client:", error);
      return {
        fetchWithPayment: null,
        isReady: false,
      };
    }
  }, [walletClient, address]);

  // Provide a stable callback that handles the not-ready state
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
