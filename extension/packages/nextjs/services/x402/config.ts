/**
 * x402 Service Configuration
 *
 * This module defines x402 service endpoints. The pricing is handled dynamically
 * by the x402 protocol - when you call an endpoint, it returns a 402 response
 * with the current payment requirements.
 *
 * To add a new x402 service:
 * 1. Define a new config object following the X402ServiceConfig interface
 * 2. Export it for use in your components
 */

export interface X402ServiceConfig {
  /** The full URL of the x402 endpoint */
  endpoint: string;
  /** HTTP method for the request */
  method: "GET" | "POST";
  /** Human-readable description (for UI display) */
  description?: string;
}

// ============================================
// x402 Error Handling Utilities
// ============================================

/** Map of x402 error codes to user-friendly messages */
export const X402_ERROR_MESSAGES: Record<string, string> = {
  insufficient_funds: "Insufficient USDC balance. Please add USDC to your wallet on Base network.",
  payment_required: "Payment is required for this service.",
  invalid_signature: "Payment signature is invalid. Please try again.",
  expired: "Payment authorization expired. Please try again.",
  invalid_amount: "Invalid payment amount.",
  invalid_network: "Wrong network. Please switch to Base network.",
  no_matching_payment_requirements: "No matching payment method available.",
  verification_failed: "Payment verification failed. Please try again.",
};

/** Parsed x402 payment required response */
export interface X402PaymentRequired {
  x402Version: number;
  error?: string;
  resource?: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts?: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra?: Record<string, string>;
  }>;
}

/**
 * Parse x402 error from response headers
 * @param response - The fetch Response object
 * @returns User-friendly error message or null if no x402 error found
 */
export function parseX402Error(response: Response): string | null {
  const paymentRequiredHeader = response.headers.get("payment-required");
  if (!paymentRequiredHeader) return null;

  try {
    const decoded: X402PaymentRequired = JSON.parse(atob(paymentRequiredHeader));
    if (decoded.error) {
      return X402_ERROR_MESSAGES[decoded.error] || `Payment error: ${decoded.error}`;
    }
  } catch {
    // Failed to parse header
  }
  return null;
}

/**
 * Parse full x402 payment required response from headers
 * @param response - The fetch Response object
 * @returns Parsed payment required object or null
 */
export function parseX402PaymentRequired(response: Response): X402PaymentRequired | null {
  const paymentRequiredHeader = response.headers.get("payment-required");
  if (!paymentRequiredHeader) return null;

  try {
    return JSON.parse(atob(paymentRequiredHeader));
  } catch {
    return null;
  }
}

/**
 * Horoscope API - Generates personalized daily horoscopes
 * Network: Base Mainnet
 * Pricing: Dynamic (fetched from 402 response)
 */
export const HOROSCOPE_SERVICE: X402ServiceConfig = {
  endpoint: "https://gg402.vercel.app/horoscope",
  method: "POST",
  description: "Daily horoscope powered by x402",
};

// ============================================
// Add more x402 services below as needed:
// ============================================

// Example: Weather forecast service
// export const WEATHER_SERVICE: X402ServiceConfig = {
//   endpoint: "https://example.com/weather",
//   method: "POST",
//   description: "Weather forecast API",
// };

// Example: AI image generation
// export const IMAGE_GEN_SERVICE: X402ServiceConfig = {
//   endpoint: "https://api.example.com/generate-image",
//   method: "POST",
//   description: "AI image generation",
// };
