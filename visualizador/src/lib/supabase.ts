import { createClient } from '@supabase/supabase-js';
import { getActivePricingRuleKeys, getRequiredPricingRuleKeys, type PublishedPricingCatalog } from '../catalog/pricingCatalog';
import type { SavedDesignItem, UserData } from '../types/user';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const isSupabaseConfigured = Boolean(configuredUrl && configuredKey);
const SUPABASE_URL = configuredUrl || 'https://placeholder.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = configuredKey || 'missing-public-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { storageKey: 'matearte-customer-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
export const adminSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { storageKey: 'matearte-pricing-admin-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.');
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/access` } });
}

const isProfileComplete = (profile: Pick<UserData, 'birthDate' | 'department' | 'city' | 'addressLine1'>) =>
  Boolean(profile.birthDate && profile.department?.trim() && profile.city?.trim() && profile.addressLine1?.trim());

export async function createProfileAvatarSignedUrl(objectPath?: string | null) {
  if (!objectPath) return { data: null, error: null };
  return supabase.storage.from('profile-avatars').createSignedUrl(objectPath, 60 * 60);
}

export async function uploadProfileAvatar(userId: string, file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return { path: null, signedUrl: null, error: new Error('La foto debe ser PNG, JPEG o WebP.') };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { path: null, signedUrl: null, error: new Error('La foto no puede superar los 2 MB.') };
  }
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/avatar.${extension}`;
  const { error } = await supabase.storage.from('profile-avatars').upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: true,
  });
  if (error) return { path: null, signedUrl: null, error };
  const signed = await createProfileAvatarSignedUrl(path);
  return { path, signedUrl: signed.data?.signedUrl ?? null, error: signed.error };
}

export async function saveUserProfileToSupabase(userData: UserData) {
  if (!isSupabaseConfigured) return { profile: null, error: new Error('Supabase no está configurado.') };
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || (userData.id && userData.id !== user.id)) return { profile: null, error: userError || new Error('La sesión no es válida.') };
  const complete = isProfileComplete(userData);
  const { data, error } = await supabase.from('customer_profiles').upsert({
    user_id: user.id,
    full_name: userData.name.trim().slice(0, 120),
    phone: userData.phone?.trim().slice(0, 40) || null,
    company: userData.company?.trim().slice(0, 120) || null,
    birth_date: userData.birthDate || null,
    department: userData.department?.trim().slice(0, 80) || null,
    city: userData.city?.trim().slice(0, 120) || null,
    address_line1: userData.addressLine1?.trim().slice(0, 180) || null,
    postal_code: userData.postalCode?.trim().slice(0, 20) || null,
    avatar_path: userData.avatarPath || null,
    profile_completed_at: complete ? new Date().toISOString() : null,
  }, { onConflict: 'user_id' }).select().single();
  return {
    profile: data ? {
      id: data.user_id,
      name: data.full_name,
      phone: data.phone || '',
      company: data.company || '',
      birthDate: data.birth_date || '',
      department: data.department || '',
      city: data.city || '',
      addressLine1: data.address_line1 || '',
      postalCode: data.postal_code || '',
      avatarPath: data.avatar_path || '',
      profileComplete: Boolean(data.profile_completed_at),
    } : null,
    error,
  };
}

const normalizeDesign = (row: Record<string, any>): SavedDesignItem => ({
  id: String(row.id), user_id: row.user_id ? String(row.user_id) : undefined,
  client_draft_id: String(row.client_draft_id || row.id),
  design_code: String(row.design_code || `MA-${String(row.id).replaceAll('-', '').slice(0, 8).toUpperCase()}`),
  title: String(row.title || 'Diseño sin título'), configuration: row.configuration,
  fleje_config: row.fleje_configuration,
  status: row.status === 'saved' || row.status === 'archived' ? row.status : 'draft',
  created_at: String(row.created_at || row.updated_at || new Date().toISOString()),
  updated_at: String(row.updated_at || row.created_at || new Date().toISOString()),
});

export async function saveDesignToSupabase(params: {
  designId?: string | null; clientDraftId: string; userId?: string; configuration: any; flejeConfig: any; title?: string; status?: 'draft' | 'saved';
}) {
  if (!isSupabaseConfigured || !params.userId) return { data: null, error: new Error('Necesitás iniciar sesión para guardar.') };
  const payload = {
    user_id: params.userId,
    client_draft_id: params.clientDraftId,
    title: (params.title || 'Diseño sin título').trim().slice(0, 120),
    schema_version: 1,
    configuration: params.configuration,
    fleje_configuration: params.flejeConfig,
    status: params.status || 'draft',
  };
  const query = params.designId
    ? supabase.from('designs').update(payload).eq('id', params.designId).eq('user_id', params.userId)
    : supabase.from('designs').upsert(payload, { onConflict: 'user_id,client_draft_id' });
  const { data, error } = await query.select().single();
  return { data: data ? [normalizeDesign(data)] : null, error };
}

export async function getUserDesigns(userId?: string) {
  if (!isSupabaseConfigured || !userId) return { data: [], error: null };
  const { data, error } = await supabase.from('designs').select('*').eq('user_id', userId).in('status', ['draft', 'saved']).order('updated_at', { ascending: false });
  return { data: (data || []).map(normalizeDesign), error };
}

export async function renameDesign(designId: string, title: string) {
  return supabase.from('designs').update({ title: title.trim().slice(0, 120) }).eq('id', designId).select().single();
}

export async function duplicateDesign(designId: string) {
  const source = await supabase.from('designs').select('user_id,title,schema_version,configuration,fleje_configuration,preview_path,status').eq('id', designId).single();
  if (source.error || !source.data) return { data: null, error: source.error };
  return supabase.from('designs').insert({ ...source.data, title: `${source.data.title} (copia)`.slice(0, 120), preview_path: null }).select().single();
}

export async function deleteDesign(designId: string) {
  const { error } = await supabase.from('designs').delete().eq('id', designId);
  return { error };
}

export async function createDesignAssetSignedUrl(bucket: 'design-assets' | 'design-previews', objectPath: string) {
  return supabase.storage.from(bucket).createSignedUrl(objectPath, 15 * 60);
}

const createHandoffThroughSupabase = async (
  accessToken: string,
  mainSite: string,
  action: 'continue' | 'open_cart' | 'add_design' | 'checkout',
  targetPath: '/' | '/carrito' | '/checkout' | '/pedidos' | '/perfil',
  payload: Record<string, unknown>,
) => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/auth-handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ mode: 'create', action, targetPath, payload }),
  });
  const value = await response.json().catch(() => ({})) as { code?: unknown; error?: unknown };
  if (!response.ok || typeof value.code !== 'string') {
    throw new Error(typeof value.error === 'string' ? value.error : 'No se pudo conectar el carrito con tu cuenta.');
  }
  return `${mainSite}/auth/handoff?code=${encodeURIComponent(value.code)}`;
};

export async function createMainSiteHandoff(action: 'continue' | 'open_cart' | 'add_design' | 'checkout', targetPath: '/' | '/carrito' | '/checkout' | '/pedidos' | '/perfil', payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('La sesión venció. Volvé a ingresar.');
  const mainSite = (import.meta.env.VITE_MAIN_SITE_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
  try {
    const response = await fetch(`${mainSite}/api/auth/handoff`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action, targetPath, payload }),
    });
    const value = await response.json().catch(() => ({})) as { redirectUrl?: unknown; error?: unknown };
    if (response.ok && typeof value.redirectUrl === 'string') return value.redirectUrl;
    if (response.status !== 404 && response.status !== 405 && response.status < 500) {
      throw new Error(typeof value.error === 'string' ? value.error : 'No se pudo abrir la tienda.');
    }
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
  return createHandoffThroughSupabase(session.access_token, mainSite, action, targetPath, payload);
}

export async function fetchPublishedPricingCatalog(): Promise<PublishedPricingCatalog> {
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.rpc('get_published_pricing_catalog');
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('No existe un catálogo de precios publicado.');
  const input = data as Record<string, unknown>;
  const rawRules = input.rules;
  if (!input.versionId || !input.version || !input.publishedAt || !rawRules || typeof rawRules !== 'object') throw new Error('El catálogo publicado está incompleto.');
  const rules = Object.fromEntries(Object.entries(rawRules as Record<string, unknown>).map(([key, value]) => [key, Number(value)] as const).filter((entry) => Number.isFinite(entry[1]) && entry[1] >= 0));
  const requiredRuleKeys = getRequiredPricingRuleKeys();
  const activeRuleKeys = new Set(getActivePricingRuleKeys());
  const receivedRuleKeys = Object.keys(rules);
  if (!requiredRuleKeys.every((key) => receivedRuleKeys.includes(key)) || receivedRuleKeys.some((key) => !activeRuleKeys.has(key))) throw new Error('El catálogo publicado no coincide con las reglas activas del visualizador.');
  return { versionId: String(input.versionId), version: Number(input.version), publishedAt: String(input.publishedAt), rules };
}
