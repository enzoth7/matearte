import { createClient } from '@supabase/supabase-js';

const cleanPublicEnv = (value?: string) => (value || '').replace(/\\[rn]/g, '').trim();
const url = cleanPublicEnv(import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL);
const key = cleanPublicEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');
export const supabase = createClient(url, key, { auth: { storageKey: 'matearte-commerce-admin-auth', persistSession: true } });
