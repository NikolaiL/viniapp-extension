# Analytics Environment Variables

Add these to your `.env.local` or deployment environment:

```bash
# Required: Your VINI App ID (from the VINI dashboard)
NEXT_PUBLIC_VINIAPP_ID=123

# Required: Backend URL for analytics API
NEXT_PUBLIC_BACKEND_URL=https://api.vini.app
# or
NEXT_PUBLIC_VINI_BACKEND_URL=https://api.vini.app

# Optional: Override analytics IDs (if not fetching from backend)
# These take priority over backend-fetched values
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
```

## How it works

1. **App Open Tracking**: When the mini app loads, the `PlatformProvider` automatically:
   - Detects which platform the user is on (Farcaster, Base, Worldcoin, Telegram, Web)
   - Sends an app open event to `POST /api/viniapps/{id}/analytics/open`
   - Records the platform, user ID (if available), and client FID

2. **Google Analytics / GTM**: The `AnalyticsProvider` component:
   - Fetches analytics config from the backend (or uses env vars)
   - Injects GA4 and/or GTM scripts automatically
   - Provides `trackEvent()` for custom event tracking

## Usage

### Option 1: Automatic (Recommended)

Wrap your app with both providers:

```tsx
import { PlatformProvider } from "~~/components/PlatformProvider";
import { AnalyticsProvider } from "~~/components/AnalyticsProvider";

export default function Layout({ children }) {
  return (
    <AnalyticsProvider>
      <PlatformProvider>
        {children}
      </PlatformProvider>
    </AnalyticsProvider>
  );
}
```

### Option 2: Build-time injection

For static sites or if you want to bake in the analytics IDs at build time:

```tsx
<AnalyticsProvider staticConfig={{
  googleAnalyticsId: "G-XXXXXXXXXX",
  gtmId: "GTM-XXXXXXX"
}}>
  {children}
</AnalyticsProvider>
```

## Custom Event Tracking

```tsx
import { useAnalytics } from "~~/components/AnalyticsProvider";

function MyComponent() {
  const { trackEvent } = useAnalytics();
  
  const handleClick = () => {
    trackEvent("button_click", {
      button_name: "signup",
      location: "header"
    });
  };
  
  return <button onClick={handleClick}>Sign Up</button>;
}
```
