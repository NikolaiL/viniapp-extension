"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import Script from "next/script";

/**
 * Analytics Provider for VINI Mini Apps
 * 
 * Handles:
 * - Auto-detecting viniapp by domain (no env vars needed!)
 * - Fetching analytics config from backend (GA ID, GTM ID)
 * - Injecting Google Analytics and/or Tag Manager scripts
 * - Tracking app opens by platform
 * 
 * Usage:
 * Simply wrap your app with <AnalyticsProvider>
 * The provider will auto-detect the viniapp by the current domain.
 * 
 * Optional env vars (override auto-detection):
 * - NEXT_PUBLIC_VINIAPP_ID: Force a specific viniapp ID
 * - NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: Override GA ID
 * - NEXT_PUBLIC_GTM_ID: Override GTM ID
 */

interface AnalyticsConfig {
  googleAnalyticsId: string | null;
  gtmId: string | null;
  viniappId: number | null;
  appName: string | null;
  primaryColor: string | null;
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

// Also export a safe version that returns defaults when not in provider
export const useAnalyticsSafe = () => {
  const ctx = useContext(AnalyticsContext);
  return ctx ?? {
    config: { googleAnalyticsId: null, gtmId: null, viniappId: null, appName: null, primaryColor: null },
    isReady: false,
    trackEvent: () => {},
    trackAppOpen: async () => {},
  };
};

interface AnalyticsProviderProps {
  children: ReactNode;
  // Optionally pass config directly (for build-time injection)
  staticConfig?: {
    googleAnalyticsId?: string;
    gtmId?: string;
    viniappId?: number;
  };
}

// Backend URL - can be overridden via env
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_VINI_BACKEND_URL || "https://api.vini.app";
const VINIAPP_ID = process.env.NEXT_PUBLIC_VINIAPP_ID;

export const AnalyticsProvider = ({ children, staticConfig }: AnalyticsProviderProps) => {
  const [config, setConfig] = useState<AnalyticsConfig>({
    googleAnalyticsId: staticConfig?.googleAnalyticsId || process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || null,
    gtmId: staticConfig?.gtmId || process.env.NEXT_PUBLIC_GTM_ID || null,
    viniappId: staticConfig?.viniappId || (VINIAPP_ID ? parseInt(VINIAPP_ID, 10) : null),
    appName: null,
    primaryColor: null,
  });
  const [isReady, setIsReady] = useState(false);
  const [hasTrackedOpen, setHasTrackedOpen] = useState(false);

  // Auto-detect viniapp by domain or use VINIAPP_ID
  useEffect(() => {
    const fetchConfig = async () => {
      // If we have static config for analytics, use it directly
      if (staticConfig?.googleAnalyticsId || staticConfig?.gtmId) {
        setIsReady(true);
        return;
      }

      try {
        let data: any = null;

        // Priority 1: Use VINIAPP_ID if set
        if (VINIAPP_ID) {
          const response = await fetch(`${BACKEND_URL}/api/viniapps/${VINIAPP_ID}/analytics/settings`);
          if (response.ok) {
            data = await response.json();
            data.id = parseInt(VINIAPP_ID, 10);
          }
        } 
        // Priority 2: Auto-detect by domain
        else if (typeof window !== "undefined") {
          const domain = window.location.hostname;
          console.log("[Analytics] Auto-detecting viniapp by domain:", domain);
          
          const response = await fetch(`${BACKEND_URL}/api/viniapp/lookup?domain=${encodeURIComponent(domain)}`);
          if (response.ok) {
            data = await response.json();
            console.log("[Analytics] Found viniapp:", data.name, "ID:", data.id);
          } else {
            console.log("[Analytics] No viniapp found for domain:", domain);
          }
        }

        if (data) {
          setConfig(prev => ({
            ...prev,
            viniappId: data.id || prev.viniappId,
            googleAnalyticsId: data.google_analytics_id || prev.googleAnalyticsId,
            gtmId: data.gtm_id || prev.gtmId,
            appName: data.name || prev.appName,
            primaryColor: data.primary_color || prev.primaryColor,
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

  // Track app open - uses dynamically fetched viniappId
  const trackAppOpen = async (platform: string, userId?: string, clientFid?: string) => {
    if (hasTrackedOpen) return;
    
    // Wait for config to be ready if we don't have viniappId yet
    const viniappId = config.viniappId;
    if (!viniappId) {
      console.log("[Analytics] No viniappId available, skipping app open tracking");
      return;
    }
    
    setHasTrackedOpen(true);

    try {
      await fetch(`${BACKEND_URL}/api/viniapps/${viniappId}/analytics/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          user_id: userId,
          client_fid: clientFid,
        }),
      });
      console.log(`[Analytics] Tracked app open: ${platform} for viniapp ${viniappId}`);

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
