import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

type Count = { data?: { pageviews?: number; visitors?: number } };
type Route = { route?: string; pageviews?: number };
type Aggregate = { data?: Route[] };
const dayString = (date: Date) => date.toISOString().slice(0, 10);
const dateOf = (day: string) => new Date(`${day}T00:00:00Z`);
const yesterdayUy = () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return dayString(new Date(dateOf(today).getTime() - 86400000));
};
const projects = () => {
  const config = Deno.env.get('VERCEL_ANALYTICS_SITES') || '';
  const values = Object.fromEntries(config.split(',').map((entry) => entry.trim().split(':')).filter((parts) => parts.length === 3).map(([name, , id]) => [name, id]));
  return { web: values.tienda, personalizer: values.personalizador };
};

async function authorized(request: Request, serviceKey: string) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+([^\s]+)$/i)?.[1] || '';
  if (!bearer || bearer.length > 500) return false;
  if (bearer === serviceKey) return true;
  const expectedHash = Deno.env.get('ANALYTICS_ARCHIVE_KEY_SHA256') || '';
  if (!/^[0-9a-f]{64}$/.test(expectedHash)) return false;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bearer)));
  const actualHash = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return actualHash === expectedHash;
}

Deno.serve(async (request) => {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (request.method !== 'POST' || !key || !await authorized(request, key)) return new Response('Forbidden', { status: 403 });
  const url = Deno.env.get('SUPABASE_URL') || '';
  const token = Deno.env.get('VERCEL_ANALYTICS_TOKEN') || '';
  const teamId = Deno.env.get('VERCEL_TEAM_ID') || '';
  const sites = projects();
  if (!url || !token || !/^team_[A-Za-z0-9]+$/.test(teamId) || !/^prj_[A-Za-z0-9]+$/.test(sites.web || '') || !/^prj_[A-Za-z0-9]+$/.test(sites.personalizer || '')) {
    return new Response(JSON.stringify({ error: 'Archivo de Vercel sin configurar.' }), { status: 503 });
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const latest = yesterdayUy();
  const dates = Array.from({ length: 90 }, (_, index) => dayString(new Date(dateOf(latest).getTime() - index * 86400000)));
  const { data: existing, error: readError } = await admin.from('analytics_vercel_days').select('day,site,status,error').gte('day', dates.at(-1)!).lte('day', latest);
  if (readError) return new Response(JSON.stringify({ error: 'No se pudo leer el archivo.' }), { status: 500 });
  const byKey = new Map((existing || []).map((row) => [`${row.day}:${row.site}`, row]));
  const tasks = dates.flatMap((day, age) => (['web', 'personalizer'] as const).flatMap((site) => {
    const previous = byKey.get(`${day}:${site}`);
    // Retain rejected older days as pending without retrying the same unavailable date daily.
    if (age >= 31 && previous?.error === 'vercel_400') return [];
    return age < 3 || previous?.status !== 'complete' ? [{ day, site, projectId: sites[site], wasComplete: previous?.status === 'complete' }] : [];
  }));
  const recent = tasks.filter((task) => dates.indexOf(task.day) < 3);
  const older = tasks.filter((task) => dates.indexOf(task.day) >= 3);
  const backfill = [...older.filter((task) => !byKey.has(`${task.day}:${task.site}`)), ...older.filter((task) => byKey.get(`${task.day}:${task.site}`)?.status === 'pending')].slice(0, 54);
  const selected = [...recent, ...backfill];
  let complete = 0, pending = 0;
  async function archive(task: typeof selected[number]) {
    const since = new Date(dateOf(task.day).getTime() + 3 * 3600000).toISOString();
    const until = new Date(dateOf(task.day).getTime() + 27 * 3600000 - 1).toISOString();
    const base = { projectId: task.projectId, teamId, since, until };
    let row: Record<string, unknown> = { day: task.day, site: task.site, status: 'pending', pageviews: null, daily_visitors: null, pages: [], checked_at: new Date().toISOString() };
    try {
      if (!task.projectId) throw new Error('project_missing');
      const query = async (kind: 'count' | 'aggregate', extra: Record<string, string> = {}) => {
        const params = new URLSearchParams({ ...base, ...extra });
        const result = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/${kind}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!result.ok) throw new Error(`vercel_${result.status}`);
        return await result.json();
      };
      const count = await query('count') as Count;
      if (!Number.isInteger(count.data?.pageviews) || !Number.isInteger(count.data?.visitors)) throw new Error('invalid_response');
      let routes: Aggregate = { data: [] };
      let routeError: string | null = null;
      try {
        routes = await query('aggregate', { by: 'route', limit: '100' }) as Aggregate;
        if (!Array.isArray(routes.data)) throw new Error('invalid_routes');
      } catch (error) {
        routes = { data: [] };
        routeError = error instanceof Error ? error.message.slice(0, 40) : 'routes_unavailable';
      }
      row = { ...row, status: 'complete', pageviews: count.data!.pageviews, daily_visitors: count.data!.visitors,
        pages: routes.data!.map((item) => ({ route: String(item.route || '').slice(0, 160), pageviews: Number(item.pageviews) || 0 })), error: routeError };
      complete++;
    } catch (error) {
      pending++;
      if (task.wasComplete) return;
      row.error = error instanceof Error ? error.message.slice(0, 40) : 'unknown';
    }
    const { error: writeError } = await admin.from('analytics_vercel_days').upsert(row, { onConflict: 'day,site' });
    if (writeError) throw writeError;
  }
  for (let index = 0; index < selected.length; index += 6) await Promise.all(selected.slice(index, index + 6).map(archive));
  return new Response(JSON.stringify({ checked: selected.length, complete, pending }), { headers: { 'Content-Type': 'application/json' } });
});
