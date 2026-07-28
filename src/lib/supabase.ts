import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibsbbkmqghiacgkrtmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnNiYmttcWdoaWFjZ2tydG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODk4NjIsImV4cCI6MjEwMDE2NTg2Mn0.7ztsQM6OqTw8d_j_eKTlsabdpph6UJxZPrtVNFWuhjE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function signInWithGoogle() {
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
  try {
    const { error } = await supabase.from('designs').delete().eq('id', designId);
    if (error) throw error;
    return { error: null };
  } catch (err: any) {
    console.error('Error deleting design:', err);
    return { error: err };
  }
}
