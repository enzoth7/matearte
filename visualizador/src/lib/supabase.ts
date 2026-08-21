import { createClient } from '@supabase/supabase-js';
import { getActivePricingRuleKeys, getRequiredPricingRuleKeys, type PublishedPricingCatalog } from '../catalog/pricingCatalog';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(configuredUrl && configuredKey);

const SUPABASE_URL = configuredUrl || 'https://placeholder.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = configuredKey || 'matearte-demo-mode';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
export const adminSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: 'matearte-pricing-admin-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  return { data, error };
}

export async function saveUserProfileToSupabase(userData: {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
}) {
  if (!isSupabaseConfigured || userData.id?.startsWith('demo-')) {
    return { profile: null, error: null };
  }

  try {
    const cleanEmail = userData.email.trim().toLowerCase();

    // 1. Check if profile exists by email
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      // Update existing profile
      const { data: updated, error: updateErr } = await supabase
        .from('profiles')
        .update({
          name: userData.name,
          phone: userData.phone || null,
          company: userData.company || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateErr) console.warn('Note on profile update:', updateErr.message);
      return { profile: updated || existing, error: null };
    }

    // 2. Insert new profile if not found
    const { data: inserted, error: insertErr } = await supabase
      .from('profiles')
      .insert([
        {
          email: cleanEmail,
          name: userData.name,
          phone: userData.phone || null,
          company: userData.company || null,
        },
      ])
      .select()
      .single();

    if (insertErr) {
      console.error('Error inserting profile:', insertErr);
      return { profile: null, error: insertErr };
    }

    return { profile: inserted, error: null };
  } catch (err: any) {
    console.error('Error saving user profile to Supabase:', err);
    return { profile: null, error: err };
  }
}

export async function saveDesignToSupabase(params: {
  designId?: string | null;
  userId?: string;
  configuration: any;
  flejeConfig: any;
  title?: string;
  status?: 'draft' | 'submitted';
}) {
  if (!isSupabaseConfigured) return { data: null, error: null };

  try {
    if (!params.userId) {
      console.warn('saveDesignToSupabase called without userId, skipping or saving unassigned');
    }

    if (params.designId) {
      // ACTUALIZAR el diseño existente
      const { data, error } = await supabase
        .from('designs')
        .update({
          user_id: params.userId || null,
          title: params.title || 'Mi Mate Custom',
          configuration: params.configuration,
          fleje_config: params.flejeConfig,
          status: params.status || 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.designId)
        .select();

      if (error) throw error;
      return { data, error: null };
    }

    // INSERTAR nuevo diseño si no existía designId
    const { data, error } = await supabase.from('designs').insert([
      {
        user_id: params.userId || null,
        title: params.title || 'Mi Mate Custom',
        configuration: params.configuration,
        fleje_config: params.flejeConfig,
        status: params.status || 'draft',
      },
    ]).select();

    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    console.error('Error saving design to Supabase:', err);
    return { data: null, error: err };
  }
}

export async function getUserDesigns(userId?: string) {
  if (!isSupabaseConfigured) return { data: [], error: null };

  try {
    if (!userId) {
      // If no user ID is present, return empty list so users don't see unassigned drafts
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('designs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('Error fetching user designs:', err);
    return { data: [], error: err };
  }
}

export async function deleteDesign(designId: string) {
  if (!isSupabaseConfigured) return { error: null };

  try {
    const { error } = await supabase.from('designs').delete().eq('id', designId);
    if (error) throw error;
    return { error: null };
  } catch (err: any) {
    console.error('Error deleting design:', err);
    return { error: err };
  }
}

export async function fetchPublishedPricingCatalog(): Promise<PublishedPricingCatalog> {
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.rpc('get_published_pricing_catalog');
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('No existe un catálogo de precios publicado.');

  const input = data as Record<string, unknown>;
  const rawRules = input.rules;
  if (!input.versionId || !input.version || !input.publishedAt || !rawRules || typeof rawRules !== 'object') {
    throw new Error('El catálogo publicado está incompleto.');
  }

  const rules = Object.fromEntries(
    Object.entries(rawRules as Record<string, unknown>)
      .map(([key, value]) => [key, Number(value)] as const)
      .filter((entry) => Number.isFinite(entry[1]) && entry[1] >= 0),
  );

  const requiredRuleKeys = getRequiredPricingRuleKeys();
  const activeRuleKeys = new Set(getActivePricingRuleKeys());
  const receivedRuleKeys = Object.keys(rules);
  const hasRequiredRules = requiredRuleKeys.every((key) => receivedRuleKeys.includes(key));
  const hasUnknownRules = receivedRuleKeys.some((key) => !activeRuleKeys.has(key));
  if (!hasRequiredRules || hasUnknownRules) throw new Error('El catálogo publicado no coincide con las reglas activas del visualizador.');

  return {
    versionId: String(input.versionId),
    version: Number(input.version),
    publishedAt: String(input.publishedAt),
    rules,
  };
}
