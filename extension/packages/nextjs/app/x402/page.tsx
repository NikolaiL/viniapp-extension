"use client";

import type { NextPage } from "next";
import { HoroscopeWidget } from "~~/components/x402/HoroscopeWidget";

/**
 * x402 Example Page
 *
 * This page demonstrates the x402 micropayment protocol with a horoscope API.
 * Users can select their zodiac sign and focus area, then pay a small fee
 * to receive their personalized daily horoscope.
 *
 * The x402 protocol handles:
 * - Dynamic pricing (fetched from the service)
 * - Payment signing via the connected wallet
 * - Automatic retry with payment proof
 */
const X402Page: NextPage = () => {
  return (
    <div className="flex items-center flex-col grow pt-10 px-4">
      <div className="w-full max-w-2xl">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">x402 Payment Demo</h1>
          <p className="text-base-content/70">
            Experience micropayments with the x402 protocol. Pay only for what you use.
          </p>
        </div>

        {/* Horoscope Widget */}
        <HoroscopeWidget />

        {/* Info Section */}
        <div className="mt-8 p-4 bg-base-200 rounded-xl">
          <h3 className="font-bold mb-2">How it works</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-base-content/80">
            <li>Select your zodiac sign and focus area</li>
            <li>Click &quot;Get My Horoscope&quot; to initiate the request</li>
            <li>The service returns a payment requirement (402 response)</li>
            <li>Your wallet prompts you to sign the payment</li>
            <li>After payment, you receive your personalized horoscope</li>
          </ol>

          <div className="mt-4 p-3 bg-base-300 rounded-lg">
            <p className="text-xs text-base-content/60">
              <strong>Note:</strong> This demo uses the x402 protocol on Base Mainnet. Make sure you have ETH on Base
              for gas fees and sufficient balance for the micropayment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default X402Page;
