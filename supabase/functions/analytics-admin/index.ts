import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { hasOAuthClient } from "../../../shared/supabase-oauth-session.ts";

const origins = new Set(['https://matearte-gestion.vercel.app', 'http://localhost:5180', 'http://127.0.0.1:5180', 'http://localhost:5181', 'http://127.0.0.1:5181']);
const sections = {
  journeys: '/analitica/recorridos',
  ga4: '/analitica/google-analytics',
  clarity: '/analitica/clarity',
  vercel: '/analitica/vercel',
  changes: '/analitica/cambios',
} as const;
const reply = (body: unknown, status: number, origin: string) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', Vary: 'Origin' } : {}),
} });
const validDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const encoded = (value: Uint8Array | string) => btoa(typeof value === 'string' ? value : String.fromCharCode(...value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

async function googleSummary(start: string, end: string) {
  const property = Deno.env.get('GA4_PROPERTY_ID') || '';
  const raw = Deno.env.get('GA4_SERVICE_ACCOUNT_JSON') || '';
  if (!/^\d+$/.test(property) || !raw) return { status: 'unconfigured' };
  try {
    const account = JSON.parse(raw) as { client_email: string; private_key: string };
    const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
    const binary = Uint8Array.from(atob(pem), (letter) => letter.charCodeAt(0));
    const key = await crypto.subtle.importKey('pkcs8', binary, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const now = Math.floor(Date.now() / 1000);
    const header = encoded(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = encoded(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
    const signing = `${header}.${claim}`;
    const signature = encoded(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signing))));
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${signing}.${signature}` }) });
    if (!tokenResponse.ok) throw new Error('token');
    const token = (await tokenResponse.json() as { access_token: string }).access_token;
    const result = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ dateRanges: [{ startDate: start, endDate: end }], metrics: ['activeUsers', 'sessions', 'screenPageViews', 'userEngagementDuration', 'scrolledUsers'].map((name) => ({ name })) }) });
    if (!result.ok) throw new Error('report');
    const data = await result.json() as { rows?: { metricValues?: { value: string }[] }[] };
    const values = data.rows?.[0]?.metricValues?.map((item) => Number(item.value) || 0) || [0, 0, 0, 0, 0];
    return { status: 'ready', activeUsers: values[0], sessions: values[1], pageViews: values[2], engagementSeconds: values[3], scrolledUsers: values[4] };
  } catch { return { status: 'error' }; }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  if (request.method === 'OPTIONS') return origins.has(origin) ? reply({}, 204, origin) : reply({ error: 'Origen no permitido.' }, 403, origin);
  if (request.method !== 'POST' || (origin && !origins.has(origin))) return reply({ error: 'Solicitud no permitida.' }, 403, origin);
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!token || !url || !key) return reply({ error: 'Sesión o servicio no configurado.' }, 401, origin);
  if (hasOAuthClient(token)) return reply({ error: 'Usá el panel de Gestión para acceder a Analítica.' }, 403, origin);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return reply({ error: 'Sesión inválida.' }, 401, origin);
  const { data: member } = await admin.from('commerce_admin_users').select('active,access_user_id,allowed_paths').eq('user_id', user.id).maybeSingle();
  if (!member?.active) return reply({ error: 'Sin acceso a Analítica.' }, 403, origin);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return reply({ error: 'Solicitud inválida.' }, 400, origin); }
  const legacyReport = body.action === 'report' && body.section === undefined && member.access_user_id === 't1';
  const section = body.action === 'markChange' ? 'changes' : legacyReport ? 'journeys' : String(body.section || '');
  if (!(section in sections) || (member.access_user_id !== 't1' && !member.allowed_paths?.includes(sections[section as keyof typeof sections]))) {
    return reply({ error: 'Sin acceso a esta subpestaña de Analítica.' }, 403, origin);
  }
  if (body.action === 'markChange') {
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!validDate(body.changedOn) || !['catalog', 'custom', 'both'].includes(String(body.journey)) || description.length < 3 || description.length > 300) return reply({ error: 'Completá la fecha, la parte afectada y una descripción breve.' }, 400, origin);
    const { error } = await admin.from('analytics_changes').insert({ changed_on: body.changedOn, journey: body.journey, description, created_by: user.id });
    return error ? reply({ error: 'No se pudo guardar el cambio.' }, 500, origin) : reply({ saved: true }, 200, origin);
  }
  if (body.action !== 'report' || !validDate(body.start) || !validDate(body.end) || String(body.end) < String(body.start) || (Date.parse(`${body.end}T00:00:00Z`) - Date.parse(`${body.start}T00:00:00Z`)) / 86400000 > 179 || ![null, 'desktop', 'mobile', 'tablet'].includes((body.device || null) as string | null) || ![null, 'catalog', 'custom'].includes((body.journey || null) as string | null)) return reply({ error: 'Filtros inválidos.' }, 400, origin);
  const { data, error } = await admin.rpc('analytics_report', { p_start: body.start, p_end: body.end, p_device: body.device || null, p_journey: body.journey || null });
  if (error) return reply({ error: 'No se pudo cargar Analítica. La base puede estar pendiente de activación.' }, 503, origin);
  if (legacyReport) return reply({ ...data, ga4: await googleSummary(String(body.start), String(body.end)), clarityUrl: Deno.env.get('CLARITY_PROJECT_URL') || '' }, 200, origin);
  const ga4 = section === 'ga4' ? await googleSummary(String(body.start), String(body.end)) : { status: 'unconfigured' };
  return reply({
    steps: section === 'journeys' ? data.steps : [],
    daily: section === 'journeys' || section === 'changes' ? data.daily : [],
    vercel: section === 'vercel' ? data.vercel : [],
    changes: section === 'changes' ? data.changes : [],
    activated_on: section === 'changes' ? data.activated_on : null,
    ga4,
    clarityUrl: section === 'clarity' ? Deno.env.get('CLARITY_PROJECT_URL') || '' : '',
  }, 200, origin);
});
