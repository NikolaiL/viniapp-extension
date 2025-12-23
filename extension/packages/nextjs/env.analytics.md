# Analytics Configuration

**No environment variables needed!** The mini app auto-detects its configuration from the VINI backend by domain.

## How It Works

1. **User configures in VINI Dashboard** → Config page → Analytics & Tracking
2. **Mini app deploys** → Domain gets stored in `website_url`
3. **User opens mini app** → App fetches config by `window.location.hostname`
4. **Backend returns** → GA ID, GTM ID, app name, primary color
5. **Scripts injected** → GA4/GTM loads dynamically

```
User visits: https://myapp.vercel.app
     ↓
GET /api/viniapp/lookup?domain=myapp.vercel.app
     ↓
Backend returns: { id: 123, google_analytics_id: "G-XXX", gtm_id: "GTM-YYY" }
     ↓
Analytics scripts injected, app open tracked
```

## Optional Environment Variables

You can override auto-detection if needed:

```bash
# Force a specific viniapp ID (bypasses domain lookup)
NEXT_PUBLIC_VINIAPP_ID=123

# Override backend URL (default: https://api.vini.app)
NEXT_PUBLIC_BACKEND_URL=https://api.vini.app

# Override analytics IDs (bypasses backend fetch)
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
```

## Usage

### Basic (Recommended)

Just wrap your app - everything is automatic:

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

The providers will:
1. Auto-detect the viniapp by domain
2. Fetch GA/GTM IDs from backend
3. Inject analytics scripts
4. Track app opens by platform (farcaster, base, worldcoin, telegram, web)

### With Static Config

For testing or static sites:

```tsx
<AnalyticsProvider staticConfig={{
  googleAnalyticsId: "G-XXXXXXXXXX",
  gtmId: "GTM-XXXXXXX",
  viniappId: 123
}}>
  {children}
</AnalyticsProvider>
```

## Custom Event Tracking

```tsx
import { useAnalytics } from "~~/components/AnalyticsProvider";

function MyComponent() {
  const { trackEvent, config } = useAnalytics();
  
  const handleClick = () => {
    trackEvent("button_click", {
      button_name: "signup",
      app_name: config.appName,
    });
  };
  
  return <button onClick={handleClick}>Sign Up</button>;
}
```

## API Endpoint

The mini app calls this endpoint to get its config:

```
GET /api/viniapp/lookup?domain=myapp.vercel.app

Response:
{
  "id": 123,
  "name": "My App",
  "google_analytics_id": "G-XXXXXXXXXX",
  "gtm_id": "GTM-XXXXXXX",
  "primary_color": "#6366f1",
  "platforms": ["farcaster", "base"],
  "platform_config": {}
}
```

## What Gets Tracked

| Event | When | Data |
|-------|------|------|
| App Open | On load | platform, user_id, client_fid |
| Page View | Auto (GA4) | page_path |
| Custom | Your code | Any params |

Platform values: `farcaster`, `base`, `worldcoin`, `telegram`, `web`
