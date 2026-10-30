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
    import('./catalog/rimIconCatalog.ts'),
  ]).then(async ([{ default: App }, { PricingProvider }, { applyPublishedCatalog }, { supabase, isSupabaseConfigured }, { applyUploadedRimIcons }]) => {
    if (isSupabaseConfigured) {
      await Promise.allSettled([
        (async () => {
          const result = await Promise.race([
            supabase.rpc('get_published_visualizer_catalog'),
            new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 3500)),
          ]);
          if (result && !result.error) applyPublishedCatalog(result.data);
        })(),
        (async () => {
          const [result, hiddenResult] = await Promise.all([
            Promise.race([
              supabase.from('visualizer_icons').select('id,name,storage_path,is_active').order('created_at'),
              new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 3500)),
            ]),
            Promise.race([
              supabase.from('visualizer_hidden_builtin_icons').select('icon_id'),
              new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 3500)),
            ]),
          ]);
          if ((result && !result.error && result.data) || (hiddenResult && !hiddenResult.error && hiddenResult.data)) applyUploadedRimIcons((result && !result.error && result.data ? result.data : []).map((icon) => ({
            id: `icon-${icon.id}`,
            name: icon.name,
            src: supabase.storage.from('visualizer-catalog').getPublicUrl(icon.storage_path).data.publicUrl,
            is_active: icon.is_active,
          })), hiddenResult && !hiddenResult.error && hiddenResult.data ? hiddenResult.data.map((row) => row.icon_id) : []);
        })(),
      ]);
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
