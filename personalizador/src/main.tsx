import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import 'country-flag-icons/3x2/flags.css'
import './index.css'
import { getMisroutedStoreAuthCallbackUrl } from './lib/authRedirect.ts'

const storeCallbackUrl = getMisroutedStoreAuthCallbackUrl(
  window.location,
  import.meta.env.VITE_MAIN_SITE_URL,
)

if (storeCallbackUrl) {
  // The PKCE verifier belongs to the store origin. Redirect before importing App,
  // otherwise Supabase may restore an unrelated personalizer session from localStorage.
  window.location.replace(storeCallbackUrl)
} else {
  void Promise.all([
    import('./App.tsx'),
    import('./context/PricingContext.tsx'),
    import('./catalog/publishedCatalog.ts'),
    import('./lib/supabase.ts'),
  ]).then(async ([{ default: App }, { PricingProvider }, { applyPublishedCatalog }, { supabase, isSupabaseConfigured }]) => {
    if (isSupabaseConfigured) {
      try {
        const result = await Promise.race([
          supabase.rpc('get_published_visualizer_catalog'),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 3500)),
        ]);
        if (result && !result.error) applyPublishedCatalog(result.data);
      } catch {
        // The built-in catalog remains available if the network is temporarily unavailable.
      }
    }
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <BrowserRouter>
          <PricingProvider>
            <App />
          </PricingProvider>
          <Analytics />
        </BrowserRouter>
      </StrictMode>,
    )
  })
}
