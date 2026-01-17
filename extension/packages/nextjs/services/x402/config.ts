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

/**
 * Get the proxied URL for an x402 endpoint
 * This routes requests through our API proxy to avoid CORS issues
 *
 * @param endpoint - The original x402 endpoint URL
 * @returns The proxied URL that goes through /api/x402
 */
export function getProxiedUrl(endpoint: string): string {
  return `/api/x402?url=${encodeURIComponent(endpoint)}`;
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
