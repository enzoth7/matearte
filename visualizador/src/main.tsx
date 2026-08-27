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
  // otherwise Supabase may restore an unrelated visualizer session from localStorage.
  window.location.replace(storeCallbackUrl)
} else {
  void Promise.all([
    import('./App.tsx'),
    import('./context/PricingContext.tsx'),
  ]).then(([{ default: App }, { PricingProvider }]) => {
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
