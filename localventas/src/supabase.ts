import { createClient } from '@supabase/supabase-js'

const cleanPublicEnv = (value?: string) => (value || '').replace(/\\[rn]/g, '').trim()
const url = cleanPublicEnv(import.meta.env.VITE_SUPABASE_URL)
const key = cleanPublicEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)

if (!url || !key) throw new Error('Falta la configuración pública de Supabase.')

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'matearte-local-sales-auth',
  },
})
