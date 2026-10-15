import { createBrowserClient } from "@supabase/ssr";

const cleanPublicEnv = (value: string | undefined) => value
  ?.trim()
  .replace(/^["']|["']$/g, "")
  .replace(/\\[rn]+$/, "")
  .trim();

export function createBrowserSupabase() {
  const url = cleanPublicEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanPublicEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!url || !key) throw new Error("El acceso a la cuenta todavía no está configurado.");
  return createBrowserClient(url, key);
}
