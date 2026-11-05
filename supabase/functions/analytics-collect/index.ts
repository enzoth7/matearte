import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const origins = new Set([
  'https://matearteuruguay.com', 'https://www.matearteuruguay.com',
  'https://personalizador.matearteuruguay.com',
  'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173',
]);
const journeys = new Set(['catalog', 'custom']);
const devices = new Set(['desktop', 'tablet', 'mobile']);
const steps = new Set(['entry', 'catalog', 'product', 'custom_page', 'personalizer_open', 'mate_selected', 'design_started', 'summary', 'cart']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const respond = (status: number, origin: string, data: unknown = {}) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', Vary: 'Origin' } : {}),
} });

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  if (!origins.has(origin)) return respond(403, origin);
  if (request.method === 'OPTIONS') return respond(204, origin);
  if (request.method !== 'POST') return respond(405, origin);
  const raw = await request.text();
  if (raw.length > 1000) return respond(413, origin);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return respond(400, origin); }
  if (!uuid.test(String(body.event_id)) || !uuid.test(String(body.session_id)) ||
      !journeys.has(String(body.journey)) || !devices.has(String(body.device)) ||
      !steps.has(String(body.step)) || !['step', 'screen'].includes(String(body.kind)) ||
      !Number.isInteger(body.visible_ms) || Number(body.visible_ms) < 0 || Number(body.visible_ms) > 1800000 ||
      !Number.isInteger(body.scroll_pct) || Number(body.scroll_pct) < 0 || Number(body.scroll_pct) > 100) return respond(400, origin);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return respond(503, origin);
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await client.from('analytics_events').upsert({
    event_id: body.event_id, session_id: body.session_id,
    journey: body.journey, device: body.device, step: body.step, kind: body.kind,
    visible_ms: body.visible_ms, scroll_pct: body.scroll_pct,
  }, { onConflict: 'event_id', ignoreDuplicates: true });
  return error ? respond(500, origin) : respond(202, origin);
});
