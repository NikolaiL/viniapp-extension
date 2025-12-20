"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import Script from "next/script";

/**
 * Analytics Provider for VINI Mini Apps
 * 
 * Handles:
 * - Fetching analytics config from backend (GA ID, GTM ID)
 * - Injecting Google Analytics and/or Tag Manager scripts
 * - Tracking app opens by platform
 * 
 * Usage:
 * 1. Set NEXT_PUBLIC_VINIAPP_ID in your .env
 * 2. Wrap your app with <AnalyticsProvider>
 * 3. Use useAnalytics() hook to track custom events
 */

interface AnalyticsConfig {
  googleAnalyticsId: string | null;
  gtmId: string | null;
  viniappId: number | null;
}

interface AnalyticsContextType {
  config: AnalyticsConfig;
  isReady: boolean;
  trackEvent: (eventName: string, params?: Record<string, any>) => void;
  trackAppOpen: (platform: string, userId?: string, clientFid?: string) => Promise<void>;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export const useAnalytics = () => {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) {
    throw new Error("useAnalytics must be used within AnalyticsProvider");
  }
  return ctx;
};

interface AnalyticsProviderProps {
  children: ReactNode;
  // Optionally pass config directly (for build-time injection)
  staticConfig?: {
    googleAnalyticsId?: string;
    gtmId?: string;
  };
}

// Backend URL - can be overridden via env
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_VINI_BACKEND_URL || "https://api.vini.app";
const VINIAPP_ID = process.env.NEXT_PUBLIC_VINIAPP_ID;

export const AnalyticsProvider = ({ children, staticConfig }: AnalyticsProviderProps) => {
  const [config, setConfig] = useState<AnalyticsConfig>({
    googleAnalyticsId: staticConfig?.googleAnalyticsId || process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || null,
    gtmId: staticConfig?.gtmId || process.env.NEXT_PUBLIC_GTM_ID || null,
    viniappId: VINIAPP_ID ? parseInt(VINIAPP_ID, 10) : null,
  });
  const [isReady, setIsReady] = useState(false);
  const [hasTrackedOpen, setHasTrackedOpen] = useState(false);

  // Fetch config from backend if VINIAPP_ID is set and we don't have static config
  useEffect(() => {
    const fetchConfig = async () => {
      if (!VINIAPP_ID || (staticConfig?.googleAnalyticsId || staticConfig?.gtmId)) {
        setIsReady(true);
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/api/viniapps/${VINIAPP_ID}/analytics/settings`);
        if (response.ok) {
          const data = await response.json();
          setConfig(prev => ({
            ...prev,
            googleAnalyticsId: data.google_analytics_id || prev.googleAnalyticsId,
            gtmId: data.gtm_id || prev.gtmId,
          }));
        }
      } catch (error) {
        console.warn("[Analytics] Failed to fetch config:", error);
      } finally {
        setIsReady(true);
      }
    };

    fetchConfig();
  }, [staticConfig]);

  // Track custom events via GA4
  const trackEvent = (eventName: string, params?: Record<string, any>) => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", eventName, params);
    }
  };

  // Track app open
  const trackAppOpen = async (platform: string, userId?: string, clientFid?: string) => {
    if (hasTrackedOpen || !VINIAPP_ID) return;
    
    setHasTrackedOpen(true);

    try {
      await fetch(`${BACKEND_URL}/api/viniapps/${VINIAPP_ID}/analytics/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          user_id: userId,
          client_fid: clientFid,
        }),
      });
      console.log(`[Analytics] Tracked app open: ${platform}`);

      // Also track in GA4 if available
      trackEvent("app_open", {
        platform,
        user_id: userId,
        client_fid: clientFid,
      });
    } catch (error) {
      console.warn("[Analytics] Failed to track app open:", error);
    }
  };

  const value: AnalyticsContextType = {
    config,
    isReady,
    trackEvent,
    trackAppOpen,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {/* Google Tag Manager */}
      {config.gtmId && (
        <>
          <Script
            id="gtm-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${config.gtmId}');
              `,
            }}
          />
          {/* GTM noscript fallback - rendered as iframe in body */}
        </>
      )}

      {/* Google Analytics 4 (if not using GTM) */}
      {config.googleAnalyticsId && !config.gtmId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${config.googleAnalyticsId}', {
                  page_path: window.location.pathname,
                  send_page_view: true
                });
              `,
            }}
          />
        </>
      )}

      {children}
    </AnalyticsContext.Provider>
  );
};

/**
 * GTM NoScript component - place in body for users with JS disabled
 */
export const GTMNoScript = ({ gtmId }: { gtmId?: string | null }) => {
  const id = gtmId || process.env.NEXT_PUBLIC_GTM_ID;
  if (!id) return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${id}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
};
