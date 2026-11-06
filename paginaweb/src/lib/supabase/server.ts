import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseServiceRoleKey, supabaseUrl } from "./config";
import { hasOAuthClient } from "../../../../shared/supabase-oauth-session";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot mutate cookies; Route Handlers can.
        }
      },
    },
  });
}

// Pass only an actor verified by auth.getUser, never a caller-provided ID.
export function createAdminSupabase(auditActorId?: string) {
  return createClient(supabaseUrl(), supabaseServiceRoleKey(), {
    ...(auditActorId ? { global: { headers: { "x-gestion-actor-id": auditActorId, "x-gestion-operation-id": crypto.randomUUID() } } } : {}),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createPublicSupabase() {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createTokenSupabase(accessToken: string) {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function getFirstPartyTokenUser(accessToken: string) {
  if (hasOAuthClient(accessToken)) return null;
  const { data, error } = await createTokenSupabase(accessToken).auth.getUser(accessToken);
  return error ? null : data.user;
}

export async function requireUser() {
  const client = await createServerSupabase();
  const { data: { session } } = await client.auth.getSession();
  if (!session || hasOAuthClient(session.access_token)) return { client, user: null };
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { client, user: null };
  return { client, user };
}
