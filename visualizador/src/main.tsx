import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import 'country-flag-icons/3x2/flags.css'
import './index.css'
import App from './App.tsx'
import { PricingProvider } from './context/PricingContext.tsx'

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
