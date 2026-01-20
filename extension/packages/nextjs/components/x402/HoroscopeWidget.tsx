"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useX402Fetch } from "~~/hooks/useX402Fetch";
import { HOROSCOPE_SERVICE } from "~~/services/x402/config";

// Zodiac signs with their symbols
const ZODIAC_SIGNS = [
  { name: "Aries", symbol: "♈" },
  { name: "Taurus", symbol: "♉" },
  { name: "Gemini", symbol: "♊" },
  { name: "Cancer", symbol: "♋" },
  { name: "Leo", symbol: "♌" },
  { name: "Virgo", symbol: "♍" },
  { name: "Libra", symbol: "♎" },
  { name: "Scorpio", symbol: "♏" },
  { name: "Sagittarius", symbol: "♐" },
  { name: "Capricorn", symbol: "♑" },
  { name: "Aquarius", symbol: "♒" },
  { name: "Pisces", symbol: "♓" },
] as const;

// Focus areas for the horoscope
const FOCUS_AREAS = [
  { value: "general", label: "General", icon: "✨" },
  { value: "love", label: "Love", icon: "💕" },
  { value: "career", label: "Career", icon: "💼" },
  { value: "health", label: "Health", icon: "🌿" },
] as const;

// Response type from the horoscope API
interface HoroscopeResponse {
  horoscope: string;
  lucky_number: number;
  advice: string;
  processedAt?: string;
}

export function HoroscopeWidget() {
  const { isConnected } = useAccount();
  const { fetchWithPayment, isReady, isLoading: isWalletLoading } = useX402Fetch();

  // Form state
  const [zodiacSign, setZodiacSign] = useState<string>("");
  const [focusArea, setFocusArea] = useState<string>("general");

  // Request state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HoroscopeResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!zodiacSign) {
      setError("Please select your zodiac sign");
      return;
    }

    if (!isReady) {
      setError("Please connect your wallet to continue");
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare the request body
      const body: Record<string, string> = {
        zodiac_sign: zodiacSign,
      };

      // Only include focus_area if it's not "general" (API default)
      if (focusArea && focusArea !== "general") {
        body.focus_area = focusArea;
      }

      // Make the x402 request directly - payment is handled automatically
      const response = await fetchWithPayment(HOROSCOPE_SERVICE.endpoint, {
        method: HOROSCOPE_SERVICE.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Request failed: ${response.status} ${errorText}`);
      }

      const data: HoroscopeResponse = await response.json();
      setResult(data);
    } catch (err) {
      console.error("Horoscope request failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  // Get the selected zodiac info for display
  const selectedZodiac = ZODIAC_SIGNS.find(z => z.name === zodiacSign);
  const selectedFocus = FOCUS_AREAS.find(f => f.value === focusArea);

  // Show wallet connection prompt if not connected
  if (!isConnected) {
    return (
      <div className="card bg-base-100 shadow-xl w-full max-w-lg mx-auto">
        <div className="card-body text-center">
          <h2 className="card-title justify-center text-2xl">🔮 Daily Horoscope</h2>
          <p className="text-base-content/70">Connect your wallet to get your personalized horoscope</p>
          <p className="text-sm text-base-content/50 mt-2">
            This service uses x402 micropayments - you&apos;ll pay a small fee for each reading
          </p>
        </div>
      </div>
    );
  }

  // Show loading state while wallet is initializing
  if (isWalletLoading) {
    return (
      <div className="card bg-base-100 shadow-xl w-full max-w-lg mx-auto">
        <div className="card-body text-center">
          <span className="loading loading-spinner loading-lg mx-auto"></span>
          <p>Initializing wallet...</p>
        </div>
      </div>
    );
  }

  // Show result if we have one
  if (result) {
    return (
      <div className="card bg-base-100 shadow-xl w-full max-w-lg mx-auto">
        <div className="card-body">
          {/* Header with zodiac and focus */}
          <div className="text-center mb-4">
            <div className="text-5xl mb-2">{selectedZodiac?.symbol}</div>
            <h2 className="card-title justify-center text-2xl">{selectedZodiac?.name}</h2>
            <div className="badge badge-primary mt-2">
              {selectedFocus?.icon} {selectedFocus?.label}
            </div>
          </div>

          {/* Horoscope text */}
          <div className="bg-base-200 rounded-xl p-4 mb-4">
            <p className="text-lg leading-relaxed">{result.horoscope}</p>
          </div>

          {/* Lucky number and advice */}
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl p-4 text-center">
              <div className="text-sm font-medium text-base-content/70 mb-1">Lucky Number</div>
              <div className="text-4xl font-bold text-primary">{result.lucky_number}</div>
            </div>

            <div className="bg-base-200 rounded-xl p-4">
              <div className="text-sm font-medium text-base-content/70 mb-2">💡 Advice</div>
              <p className="text-base-content">{result.advice}</p>
            </div>
          </div>

          {/* Try again button */}
          <div className="card-actions justify-center mt-4">
            <button className="btn btn-primary" onClick={handleReset}>
              Get Another Reading
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show the form
  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-lg mx-auto">
      <div className="card-body">
        <h2 className="card-title justify-center text-2xl mb-2">🔮 Daily Horoscope</h2>
        <p className="text-center text-base-content/70 text-sm mb-4">{HOROSCOPE_SERVICE.description}</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Zodiac Sign Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Select Your Zodiac Sign</span>
            </label>
            <select
              className="select select-bordered w-full text-lg"
              value={zodiacSign}
              onChange={e => setZodiacSign(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Choose your sign...</option>
              {ZODIAC_SIGNS.map(sign => (
                <option key={sign.name} value={sign.name}>
                  {sign.symbol} {sign.name}
                </option>
              ))}
            </select>
          </div>

          {/* Focus Area Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Focus Area</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FOCUS_AREAS.map(area => (
                <button
                  key={area.value}
                  type="button"
                  className={`btn ${focusArea === area.value ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setFocusArea(area.value)}
                  disabled={isSubmitting}
                >
                  {area.icon} {area.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="alert alert-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={isSubmitting || !zodiacSign || !isReady}
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Getting Your Horoscope...
              </>
            ) : (
              "Get My Horoscope"
            )}
          </button>

          {/* Payment notice */}
          <p className="text-center text-xs text-base-content/50">
            Powered by x402 micropayments • Price is set by the service provider
          </p>
        </form>
      </div>
    </div>
  );
}
