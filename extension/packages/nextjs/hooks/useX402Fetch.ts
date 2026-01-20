import { useCallback, useMemo } from "react";
import { ExactEvmScheme } from "@x402/evm";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
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
      // Create a signer object that includes the address and wallet client methods
      // The ExactEvmScheme requires an account with an address property
      const account = {
        ...walletClient,
        address: address as `0x${string}`,
      };

      // Wrap fetch with payment capabilities using the new config-based API
      // Using Base chain (eip155:8453) as configured in scaffold.config.ts
      const wrappedFetch = wrapFetchWithPaymentFromConfig(fetch, {
        schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
      });

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
