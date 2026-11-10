import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.112.4";
import { hasOAuthClient } from "../../../shared/supabase-oauth-session.ts";
import { loadMcpBridgeKey, mcpMarketingReads, mcpProofHeader, oauthIdentity, verifyMcpRequest } from "../_shared/gestionMcpBridge.ts";
import { marketingCampaignHtml } from "../../../shared/marketingCampaignHtml.ts";
import { applySegmentFilters, normalizeSegmentFilters, splitIntoBatches, type SegmentContact, type SegmentFilters, type SegmentQuery } from "../../../shared/marketingSegments.ts";

const origins = new Set(["http://127.0.0.1:5180", "http://localhost:5180", "http://127.0.0.1:5181", "http://localhost:5181", "https://matearte-gestion.vercel.app", ...(Deno.env.get("GESTION_ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean)]);
const response = (body: unknown, status = 200, origin = "") => new Response(status === 204 ? null : JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json", "Cache-Control": "no-store",
    ...(origins.has(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" } : {}),
  },
});
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const safeUrl = (value: string) => {
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : ""; } catch { return ""; }
};

type MarketingContact = { email: string; name: string | null; subscription_status: string };
type ContactDirectoryQuery = {
  or(filter: string): ContactDirectoryQuery;
  eq(column: string, value: string): ContactDirectoryQuery;
  not(column: string, operator: string, value: null): ContactDirectoryQuery;
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; count: number | null; error: unknown }>;
};
type SegmentRows = {
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): SegmentRows;
  range(from: number, to: number): PromiseLike<{ data: SegmentContact[] | null; count: number | null; error: unknown }>;
};
const montevideoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const slugify = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
// Identifica la campaña en los enlaces del correo (utm_campaign): asunto + día de creación.
const campaignUtm = (subject: string) => `${slugify(subject) || "campana"}-${montevideoToday().replaceAll("-", "")}`;
const resendHeaders = (key: string) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" });
async function resendConfig(getDeliveryConfig: () => Promise<{ data: unknown; error: unknown }>) {
  let apiKey = Deno.env.get("RESEND_API_KEY")?.trim() || "";
  let from = Deno.env.get("MARKETING_EMAIL_FROM")?.trim() || Deno.env.get("NEWSLETTER_EMAIL_FROM")?.trim() || Deno.env.get("COMMERCE_EMAIL_FROM")?.trim() || "";
  let topicId = Deno.env.get("RESEND_NEWSLETTER_TOPIC_ID")?.trim() || "";
  if (!apiKey || !from || !topicId) {
    const { data, error } = await getDeliveryConfig();
    if (error) throw new Error("No se pudo leer la configuración del correo.");
    const config = (data || {}) as Record<string, string>;
    apiKey ||= config.matearte_resend_api_key || "";
    from ||= config.matearte_email_from || "";
    topicId ||= config.matearte_newsletter_topic_id || "";
  }
  if (!apiKey || !from || !topicId) throw new Error("Resend no está configurado para campañas.");
  return { apiKey, from, topicId };
}

// El plan de Resend limita la cantidad de grupos: al preparar una campaña se liberan los de las que ya terminaron.
async function releaseFinishedSegments(admin: SupabaseClient, apiKey: string) {
  const { data: pending } = await admin.from("marketing_campaigns").select("id,status,resend_broadcast_id,resend_segment_id")
    .in("status", ["sending", "sent"]).not("resend_segment_id", "is", null).limit(10);
  for (const item of pending || []) {
    try {
      if (item.status === "sending") {
        if (!item.resend_broadcast_id) continue;
        const broadcast = await resendJson(apiKey, `/broadcasts/${encodeURIComponent(item.resend_broadcast_id)}`) as { status?: string; sent_at?: string };
        if (broadcast.status !== "sent") continue;
        await admin.from("marketing_campaigns").update({ status: "sent", sent_at: broadcast.sent_at || new Date().toISOString() }).eq("id", item.id).eq("status", "sending");
      }
      const removed = await fetch(`https://api.resend.com/segments/${encodeURIComponent(item.resend_segment_id)}`, { method: "DELETE", headers: resendHeaders(apiKey) });
      if (removed.ok || removed.status === 404) await admin.from("marketing_campaigns").update({ resend_segment_id: null }).eq("id", item.id);
    } catch { /* Se reintenta en la próxima preparación. */ }
  }
}

async function resendJson(apiKey: string, path: string, init: RequestInit = {}) {
  const result = await fetch(`https://api.resend.com${path}`, { ...init, headers: { ...resendHeaders(apiKey), ...init.headers } });
  const data = await result.json().catch(() => ({})) as Record<string, unknown>;
  if (!result.ok) throw new Error(`Resend rechazó la operación (${result.status}).`);
  return data;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") return origins.has(origin) ? response({}, 204, origin) : response({ error: "Origen no permitido." }, 403, origin);
  if (request.method !== "POST" || (origin && !origins.has(origin))) return response({ error: "Solicitud no permitida." }, 403, origin);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return response({ error: "Servicio no configurado." }, 503, origin);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const catalogKeyValid = request.headers.get("apikey") === key && !origin;
  if (!token && !catalogKeyValid) return response({ error: "Falta la sesión." }, 401, origin);
  let admin = createClient(url, key, { auth: { persistSession: false } });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return response({ error: "Solicitud inválida." }, 400, origin); }
  const action = clean(body.action, 30);
  if (action === "catalogPopularity") {
    if (!catalogKeyValid) return response({ error: "Sin acceso." }, 403, origin);
    const vercelToken = Deno.env.get("VERCEL_ANALYTICS_TOKEN")?.trim() || "";
    const teamId = Deno.env.get("VERCEL_TEAM_ID")?.trim() || "team_nvrETovmDRtUay05tg8OkZb0";
    const sites = (Deno.env.get("VERCEL_ANALYTICS_SITES") || "tienda:Tienda web:prj_wACNXNMkoQymJhRi01L4mJQ5E2a1,personalizador:Personalizador:prj_Slv0SnaWTPUZdYZ6qAzbrIHMsd49")
      .split(",").map((entry) => entry.trim().split(":"));
    const projectId = sites.find(([id]) => id === "tienda")?.[2];
    if (!vercelToken || !projectId) return response({ error: "Analytics no está configurado." }, 503, origin);
    const until = new Date();
    const since = new Date(until.getTime() - 29 * 86400000);
    since.setUTCHours(0, 0, 0, 0);
    const params = new URLSearchParams({
      projectId, teamId, since: since.toISOString(), until: until.toISOString(),
      by: "requestPath", limit: "100",
      filter: "route in ('/producto/[slug]','/[locale]/product/[slug]','/[locale]/produto/[slug]')",
    });
    try {
      const result = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/aggregate?${params}`, { headers: { Authorization: `Bearer ${vercelToken}` } });
      if (!result.ok) throw new Error(String(result.status));
      const data = await result.json() as { data?: { requestPath?: string; visitors?: number }[] };
      const counts = new Map<string, number>();
      for (const row of data.data || []) {
        let slug = "";
        try { slug = decodeURIComponent((row.requestPath || "").split("?")[0].split("/").filter(Boolean).pop() || ""); } catch { continue; }
        const visitors = Number(row.visitors) || 0;
        if (slug && visitors > 0) counts.set(slug, (counts.get(slug) || 0) + visitors);
      }
      return response({ products: [...counts].map(([slug, visitors]) => ({ slug, visitors })) }, 200, origin);
    } catch {
      return response({ error: "No se pudo consultar la popularidad del catálogo." }, 502, origin);
    }
  }
  if (!token) return response({ error: "Falta la sesión." }, 401, origin);
  let actorId: string;
  if (hasOAuthClient(token)) {
    const proof = request.headers.get(mcpProofHeader);
    if (!proof || !mcpMarketingReads.some((read) => read === action)) {
      return response({ error: "Usá las herramientas del MCP con esta credencial." }, 403, origin);
    }
    const { data } = await admin.auth.getClaims(token);
    const identity = oauthIdentity(data?.claims);
    const bridgeKey = identity ? await loadMcpBridgeKey(admin) : null;
    if (!identity || !bridgeKey || !await verifyMcpRequest(bridgeKey, identity, `marketing:${action}`, proof)) {
      return response({ error: "La solicitud del MCP no está autorizada." }, 403, origin);
    }
    actorId = identity.sub;
  } else {
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return response({ error: "Sesión inválida." }, 401, origin);
    actorId = user.id;
  }
  const { data: membership } = await admin.from("commerce_admin_users").select("active,access_user_id,allowed_paths").eq("user_id", actorId).maybeSingle();
  if (!membership?.active) return response({ error: "Sin acceso." }, 403, origin);
  // Actor comes exclusively from the verified bearer, never from request fields.
  const systemAdmin = admin;
  admin = createClient(url, key, { auth: { persistSession: false }, global: { headers: { "x-gestion-actor-id": actorId, "x-gestion-operation-id": crypto.randomUUID() } } });
  const route = action === "contacts" || action === "registrationTrend" ? "/marketing/contactos" : action === "analytics" ? "/marketing/analytics" : action === "metrics" ? "/marketing/metricas" : action === "settings" || action === "saveSettings" ? "/marketing/suscripcion" : action === "emailTemplates" || action === "emailTemplate" ? "/marketing/email-templates" : action === "segmentPreview" || action === "saveSegment" || action === "deleteSegment" ? "/marketing/segmentos" : "/marketing/campanas";
  if (membership.access_user_id !== "t1" && !membership.allowed_paths?.includes(route)) return response({ error: "No tenés acceso a esta pestaña." }, 403, origin);

  if (action === "emailTemplates" || action === "emailTemplate") {
    let resendKey = Deno.env.get("RESEND_API_KEY")?.trim() || "";
    if (!resendKey) {
      const { data, error } = await admin.rpc("get_email_delivery_config");
      if (error) return response({ error: "No se pudo consultar la configuración de correo." }, 500, origin);
      resendKey = (data as Record<string, string> | null)?.matearte_resend_api_key || "";
    }
    if (!resendKey) return response({ error: "Resend no está configurado." }, 503, origin);
    const headers = { Authorization: `Bearer ${resendKey}` };
    if (action === "emailTemplate") {
      const id = clean(body.id, 80);
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return response({ error: "Plantilla inválida." }, 400, origin);
      const result = await fetch(`https://api.resend.com/templates/${encodeURIComponent(id)}`, { headers });
      if (!result.ok) return response({ error: "No se pudo consultar la plantilla en Resend." }, 502, origin);
      const item = await result.json() as Record<string, unknown>;
      return response({ template: { id: item.id, name: item.name, alias: item.alias, status: item.status, subject: item.subject, html: item.html, text: item.text, variables: item.variables } }, 200, origin);
    }
    const templates: unknown[] = [];
    let after = "";
    for (let page = 0; page < 10; page += 1) {
      const params = new URLSearchParams({ limit: "100", ...(after ? { after } : {}) });
      const result = await fetch(`https://api.resend.com/templates?${params}`, { headers });
      if (!result.ok) return response({ error: "No se pudieron consultar las plantillas de Resend." }, 502, origin);
      const list = await result.json() as { data?: Record<string, unknown>[]; has_more?: boolean };
      const rows = Array.isArray(list.data) ? list.data : [];
      templates.push(...rows.map((item) => ({ id: item.id, name: item.name, alias: item.alias, status: item.status, updated_at: item.updated_at })));
      if (!list.has_more || !rows.length) break;
      after = String(rows.at(-1)?.id || "");
    }
    return response({ templates }, 200, origin);
  }

  if (action === "registrationTrend") {
    const days = [7, 14, 30].includes(Number(body.days)) ? Number(body.days) : 30;
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
    const today = `${part("year")}-${part("month")}-${part("day")}`;
    const startDate = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
    const { data, error } = await admin.from("marketing_daily_registrations_retail_sales")
      .select("day,registrations,retail_sales").gte("day", startDate).lte("day", today).order("day");
    if (error) return response({ error: "No se pudo cargar la evolución de registros y ventas minoristas." }, 500, origin);
    return response({ today, days, trend: data || [] }, 200, origin);
  }
  if (action === "contacts") {
    const page = Math.max(0, Math.min(10000, Math.floor(Number(body.page) || 0)));
    const query = clean(body.query, 100).replace(/[%_,().]/g, "");
    // Older Gestión deployments still send a tab name. Keep their response shape
    // until the unified directory UI is published everywhere.
    if (body.view === "accounts") {
      let accountQuery = admin.from("all_contacts").select("id,email,name,created_at", { count: "exact" }).eq("origin", "customer_account").order("created_at", { ascending: false });
      if (query) accountQuery = accountQuery.ilike("email", `%${query}%`);
      const { data: accounts, count, error } = await accountQuery.range(page * 50, page * 50 + 49);
      if (error) return response({ error: "No se pudieron cargar las cuentas." }, 500, origin);
      const emails = (accounts || []).map((row) => row.email);
      const { data: subscriptions } = emails.length ? await admin.from("newsletter_subscribers").select("email,status").in("email", emails) : { data: [] };
      const status = new Map((subscriptions || []).map((row) => [row.email, row.status]));
      return response({ contacts: (accounts || []).map((row) => ({ id: row.id, email: row.email, first_name: row.name, source: "customer_account", status: status.get(row.email) || "none", subscribed_at: row.created_at, confirmed_at: null, hasAccount: true })), count: count || 0 }, 200, origin);
    }
    if (body.view === "subscribers") {
      let subscriberQuery = admin.from("newsletter_subscribers").select("id,email,first_name,status,source,subscribed_at,confirmed_at", { count: "exact" }).order("subscribed_at", { ascending: false });
      if (query) subscriberQuery = subscriberQuery.ilike("email", `%${query}%`);
      const { data: subscribers, count, error } = await subscriberQuery.range(page * 50, page * 50 + 49);
      if (error) return response({ error: "No se pudieron cargar los contactos." }, 500, origin);
      const emails = (subscribers || []).map((row) => row.email);
      const { data: accounts } = emails.length ? await admin.from("all_contacts").select("email").eq("origin", "customer_account").in("email", emails) : { data: [] };
      const accountEmails = new Set((accounts || []).map((row) => row.email));
      return response({ contacts: (subscribers || []).map((row) => ({ ...row, hasAccount: accountEmails.has(row.email) })), count: count || 0 }, 200, origin);
    }
    const source = clean(body.source, 80);
    const channel = clean(body.channel, 12);
    let contactsQuery = admin.from("marketing_leads_directory")
      .select("id,name,source,created_at,has_account,subscription_status,country,channel", { count: "exact" })
      .not("email", "is", null)
      .order("created_at", { ascending: false }) as unknown as ContactDirectoryQuery;
    if (query) contactsQuery = contactsQuery.or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);
    if (source) contactsQuery = contactsQuery.eq("source", source);
    if (channel === "email") contactsQuery = contactsQuery.not("email", "is", null);
    if (channel === "phone") contactsQuery = contactsQuery.not("phone", "is", null);
    if (channel === "both") contactsQuery = contactsQuery.not("email", "is", null).not("phone", "is", null);
    const [pageResult, originsResult, phoneResult, activeResult, accountResult] = await Promise.all([
      contactsQuery.range(page * 50, page * 50 + 49),
      admin.from("marketing_contact_origin_counts").select("source,contacts").order("contacts", { ascending: false }),
      admin.from("marketing_contact_directory").select("id", { count: "exact", head: true }).not("email", "is", null).not("phone", "is", null),
      admin.from("marketing_contact_directory").select("id", { count: "exact", head: true }).not("email", "is", null).eq("subscription_status", "active"),
      admin.from("marketing_contact_directory").select("id", { count: "exact", head: true }).not("email", "is", null).eq("has_account", true),
    ]);
    if ([pageResult, originsResult, phoneResult, activeResult, accountResult].some((result) => result.error)) return response({ error: "No se pudieron cargar los contactos." }, 500, origin);
    const origins = originsResult.data || [];
    return response({ contacts: pageResult.data || [], count: pageResult.count || 0, summary: {
      total: origins.reduce((total, item) => total + item.contacts, 0), origins,
      withPhone: phoneResult.count || 0, active: activeResult.count || 0, accounts: accountResult.count || 0,
    } }, 200, origin);
  }
  if (action === "analytics") {
    const vercelToken = Deno.env.get("VERCEL_ANALYTICS_TOKEN")?.trim() || "";
    const teamId = Deno.env.get("VERCEL_TEAM_ID")?.trim() || "team_nvrETovmDRtUay05tg8OkZb0";
    // VERCEL_ANALYTICS_SITES: "tienda:Tienda web:prj_xxx,personalizador:Personalizador:prj_yyy"
    const sites = (Deno.env.get("VERCEL_ANALYTICS_SITES") || "tienda:Tienda web:prj_wACNXNMkoQymJhRi01L4mJQ5E2a1,personalizador:Personalizador:prj_Slv0SnaWTPUZdYZ6qAzbrIHMsd49")
      .split(",").map((entry) => entry.trim().split(":")).filter((parts) => parts.length === 3).map(([id, name, projectId]) => ({ id, name, projectId }));
    if (!vercelToken) return response({ error: "Falta configurar VERCEL_ANALYTICS_TOKEN en Supabase.", sites: sites.map(({ id, name }) => ({ id, name })) }, 503, origin);
    const site = sites.find((item) => item.id === clean(body.site, 40)) || sites[0];
    if (!site) return response({ error: "No hay sitios configurados." }, 503, origin);
    let days = [1, 7, 30, 90].includes(Number(body.days)) ? Number(body.days) : 30;
    let until = new Date();
    let since = new Date(until.getTime() - (days - 1) * 86400000);
    // "Hoy" son las últimas 24 horas; los demás períodos arrancan en un día UTC completo.
    if (days === 1) since = new Date(until.getTime() - 86400000);
    else since.setUTCHours(0, 0, 0, 0);
    if (body.startDate !== undefined || body.endDate !== undefined) {
      const startDate = clean(body.startDate, 10);
      const endDate = clean(body.endDate, 10);
      const parseDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
      const todayParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(until);
      const todayValue = (type: string) => todayParts.find((part) => part.type === type)?.value;
      const today = `${todayValue("year")}-${todayValue("month")}-${todayValue("day")}`;
      const span = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1;
      if (!parseDate(startDate) || !parseDate(endDate) || startDate > endDate || endDate > today || span > 190) {
        return response({ error: "Período de Analytics inválido." }, 400, origin);
      }
      days = span;
      // Montevideo mantiene UTC-3: incluir cada día local completo, hasta ahora si termina hoy.
      since = new Date(Date.parse(`${startDate}T00:00:00Z`) + 3 * 3600000);
      if (endDate !== today) until = new Date(Date.parse(`${endDate}T00:00:00Z`) + 27 * 3600000 - 1);
    }
    // Filtros de la pestaña: cada dimensión admite varios valores ya normalizados en el cliente.
    const filterable = ["country", "deviceType", "referrerHostname", "route", "requestPath"];
    const rawFilters = body.filters && typeof body.filters === "object" ? body.filters as Record<string, unknown> : {};
    const filter = filterable.flatMap((dimension) => {
      const values = (Array.isArray(rawFilters[dimension]) ? rawFilters[dimension] as unknown[] : []).map((value) => clean(value, 200)).filter((value) => value && !/['\\]/.test(value)).slice(0, 20);
      return values.length ? [`${dimension} in (${values.map((value) => `'${value}'`).join(",")})`] : [];
    }).join(" and ");
    const query = async (by: string, limit = 10, extra = "") => {
      const combined = [filter, extra].filter(Boolean).join(" and ");
      const params = new URLSearchParams({ projectId: site.projectId, teamId, since: since.toISOString(), until: until.toISOString(), by, limit: String(limit), ...(combined ? { filter: combined } : {}) });
      const res = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/aggregate?${params}`, { headers: { Authorization: `Bearer ${vercelToken}` } });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      return (Array.isArray(json.data) ? json.data : []) as Record<string, string | number>[];
    };
    try {
      const productQuery = () => query("requestPath", 100, "route in ('/producto/[slug]','/[locale]/product/[slug]','/[locale]/produto/[slug]')");
      const [timeline, countries, devices, referrers, pages, productPaths] = body.productsOnly === true
        ? [[], [], [], [], [], await productQuery()]
        : await Promise.all([
          query(days === 1 ? "hour" : "day", 100), query("country", 30), query("deviceType"), query("referrerHostname", 30), query("route", 30), productQuery(),
        ]);
      // El slug de la URL es el editorial_slug del producto; lo traducimos al nombre del catálogo.
      const slugOf = (path: string) => { try { return decodeURIComponent(path.split("?")[0].split("/").filter(Boolean).pop() || ""); } catch { return ""; } };
      const slugs = [...new Set(productPaths.map((row) => slugOf(String(row.requestPath))).filter(Boolean))];
      const { data: catalog } = slugs.length ? await admin.from("commerce_products").select("editorial_slug,name").in("editorial_slug", slugs) : { data: [] };
      const productNames = new Map((catalog || []).map((row) => [row.editorial_slug, row.name]));
      const rows = (data: Record<string, string | number>[], key: string) => data.map((row) => ({ label: String(row[key] || ""), pageviews: Number(row.pageviews) || 0, visitors: Number(row.visitors) || 0 }));
      return response({
        site: { id: site.id, name: site.name }, sites: sites.map(({ id, name }) => ({ id, name })), days,
        timeline: timeline.map((row) => ({ timestamp: String(row.timestamp), pageviews: Number(row.pageviews) || 0, visitors: Number(row.visitors) || 0 })),
        countries: rows(countries, "country"), devices: rows(devices, "deviceType"), referrers: rows(referrers, "referrerHostname"), pages: rows(pages, "route"),
        products: productPaths.map((row) => { const path = String(row.requestPath || ""); const slug = slugOf(path); return { label: String(productNames.get(slug) || slug.replace(/[-_]+/g, " ")), value: path, pageviews: Number(row.pageviews) || 0, visitors: Number(row.visitors) || 0 }; }).filter((row) => row.label),
      }, 200, origin);
    } catch (reason) {
      const status = Number((reason as Error).message);
      return response({ error: status === 401 || status === 403 ? "Vercel rechazó el token de Analytics." : status === 402 ? "Tu plan de Vercel no incluye esta consulta." : "No se pudieron consultar las estadísticas de Vercel." }, 502, origin);
    }
  }
  if (action === "metrics") {
    const [active, confirmed, accounts, sources, campaigns, settings] = await Promise.all([
      admin.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active"),
      admin.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active").not("confirmed_at", "is", null),
      admin.from("all_contacts").select("id", { count: "exact", head: true }).eq("origin", "customer_account"),
      admin.from("marketing_source_counts").select("source,status,contacts"),
      admin.from("marketing_campaigns").select("id", { count: "exact", head: true }).eq("status", "sent"),
      admin.from("marketing_subscription_settings").select("discount_code").eq("id", true).single(),
    ]);
    if (active.error || confirmed.error || accounts.error || sources.error || campaigns.error || settings.error) return response({ error: "No se pudieron cargar las métricas." }, 500, origin);
    const { data: discount } = await admin.from("commerce_discounts").select("id").eq("code", settings.data.discount_code).maybeSingle();
    const uses = discount ? await admin.from("commerce_discount_usages").select("id", { count: "exact", head: true }).eq("discount_id", discount.id).eq("status", "redeemed") : { count: 0, error: null };
    if (uses.error) return response({ error: "No se pudo cargar el uso del cupón." }, 500, origin);
    return response({ active: active.count, confirmed: confirmed.count, accounts: accounts.count, sent: campaigns.count, couponUses: uses.count, sources: sources.data }, 200, origin);
  }
  const segmentColumns = "email,name,source,country,channel,purchase_count,last_purchase_at";
  // Mismo orden para la vista previa y para repartir las tandas: primero quienes compraron hace menos tiempo.
  const segmentRows = (filters: SegmentFilters, columns: string) => (applySegmentFilters(
    admin.from("marketing_segment_directory").select(columns, { count: "exact" }) as unknown as SegmentQuery, filters,
  ) as unknown as SegmentRows).order("last_purchase_at", { ascending: false, nullsFirst: false }).order("email");
  if (action === "segments") {
    const [saved, people, total] = await Promise.all([
      admin.from("marketing_segments").select("id,name,filters,updated_at").order("name"),
      admin.from("marketing_segment_directory").select("source,country,channel").neq("subscription_status", "unsubscribed").limit(5000),
      admin.from("marketing_segment_directory").select("email", { count: "exact", head: true }).neq("subscription_status", "unsubscribed"),
    ]);
    if (saved.error || people.error || total.error) return response({ error: "No se pudieron cargar los segmentos." }, 500, origin);
    const distinct = (key: "source" | "country" | "channel") => [...new Set((people.data || []).map((row) => row[key]).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "es"));
    return response({ segments: saved.data || [], total: total.count || 0, options: { sources: distinct("source"), countries: distinct("country"), channels: distinct("channel") } }, 200, origin);
  }
  if (action === "segmentPreview") {
    const filters = normalizeSegmentFilters(body.filters);
    const result = await segmentRows(filters, segmentColumns).range(0, 9);
    if (result.error) return response({ error: "No se pudo calcular el segmento." }, 500, origin);
    return response({ filters, count: result.count || 0, sample: result.data || [] }, 200, origin);
  }
  if (action === "saveSegment") {
    const name = clean(body.name, 80);
    const id = clean(body.id, 36);
    if (!name) return response({ error: "Poné un nombre al segmento." }, 400, origin);
    const row = { name, filters: normalizeSegmentFilters(body.filters), updated_at: new Date().toISOString() };
    const result = id
      ? await admin.from("marketing_segments").update(row).eq("id", id).select("id").maybeSingle()
      : await admin.from("marketing_segments").insert({ ...row, created_by: actorId }).select("id").single();
    if (result.error) return response({ error: result.error.code === "23505" ? "Ya hay un segmento con ese nombre." : "No se pudo guardar el segmento." }, result.error.code === "23505" ? 409 : 400, origin);
    return result.data ? response({ id: result.data.id }, 200, origin) : response({ error: "El segmento ya no existe." }, 404, origin);
  }
  if (action === "deleteSegment") {
    const removed = await admin.from("marketing_segments").delete().eq("id", clean(body.id, 36));
    return removed.error ? response({ error: "No se pudo eliminar el segmento." }, 500, origin) : response({ ok: true }, 200, origin);
  }
  if (action === "syncUnsubscribes") {
    // Quien toca "Cancelar suscripción" queda dado de baja en Resend; acá se copia a la lista propia para que
    // Leads, Segmentos y Campañas lo dejen afuera y se vea quién es. Una baja registrada no se borra sola.
    let config;
    try { config = await resendConfig(async () => await admin.rpc("get_email_delivery_config")); } catch (error) { return response({ error: (error as Error).message }, 503, origin); }
    const optedOut = new Set<string>();
    try {
      let after = "";
      for (let page = 0; ; page += 1) {
        if (page === 50) throw new Error("Demasiados contactos.");
        const params = new URLSearchParams({ limit: "100", ...(after ? { after } : {}) });
        const list = await resendJson(config.apiKey, `/contacts?${params}`) as { data?: { id?: string; email?: string; unsubscribed?: boolean }[]; has_more?: boolean };
        const rows = Array.isArray(list.data) ? list.data : [];
        for (const row of rows) {
          const email = (row.email || "").trim().toLowerCase();
          if (email && row.unsubscribed) optedOut.add(email);
        }
        if (!list.has_more || !rows.length) break;
        after = String(rows.at(-1)?.id || "");
      }
    } catch { return response({ error: "No se pudieron consultar las bajas en Resend." }, 502, origin); }
    const known = await admin.from("marketing_unsubscribes").select("email");
    if (known.error) return response({ error: "No se pudo leer la lista de bajas." }, 500, origin);
    const knownEmails = new Set((known.data || []).map((row) => row.email as string));
    const fresh = [...optedOut].filter((email) => !knownEmails.has(email));
    if (fresh.length) {
      const saved = await admin.from("marketing_unsubscribes").upsert(fresh.map((email) => ({ email })), { onConflict: "email", ignoreDuplicates: true });
      if (saved.error) return response({ error: "No se pudieron guardar las bajas." }, 500, origin);
    }
    const [people, total] = await Promise.all([
      admin.from("marketing_unsubscribes").select("email,detected_at").order("detected_at", { ascending: false }).limit(200),
      admin.from("marketing_unsubscribes").select("email", { count: "exact", head: true }),
    ]);
    if (people.error || total.error) return response({ error: "No se pudo leer la lista de bajas." }, 500, origin);
    const emails = (people.data || []).map((row) => row.email as string);
    const names = new Map<string, string | null>();
    if (emails.length) {
      const found = await admin.from("marketing_campaign_email_directory").select("email,name").in("email", emails);
      for (const row of found.data || []) names.set(row.email as string, (row.name as string | null) || null);
    }
    return response({
      added: fresh.length, total: total.count || 0, freshEmails: fresh,
      unsubscribed: (people.data || []).map((row) => ({ email: row.email, name: names.get(row.email as string) ?? null, detected_at: row.detected_at })),
    }, 200, origin);
  }
  if (action === "campaignDiscounts") {
    const { data, error } = await admin.from("commerce_discounts").select("code,discount_type,value,valid_from,valid_until")
      .eq("enabled", true).eq("welcome_only", false).gte("valid_until", montevideoToday()).order("valid_until");
    return error ? response({ error: "No se pudieron cargar los descuentos." }, 500, origin) : response({ discounts: data || [] }, 200, origin);
  }
  if (action === "campaignQuota") {
    // Montevideo no cambia de hora: el día local empieza a las 03:00 UTC.
    const { data, error } = await admin.from("marketing_campaigns").select("recipient_count")
      .in("status", ["sending", "sent"]).gte("send_requested_at", `${montevideoToday()}T03:00:00Z`);
    return error ? response({ error: "No se pudo consultar el cupo del día." }, 500, origin)
      : response({ sentToday: (data || []).reduce((total, row) => total + (row.recipient_count || 0), 0) }, 200, origin);
  }
  if (action === "createBatches") {
    const id = clean(body.id, 36);
    const batchSize = Math.floor(Number(body.batchSize));
    if (!(batchSize >= 1 && batchSize <= 500)) return response({ error: "Elegí entre 1 y 500 correos por tanda." }, 400, origin);
    let filters: SegmentFilters = normalizeSegmentFilters(body.filters);
    let segmentName: string | null = null;
    const segmentId = clean(body.segmentId, 36);
    if (segmentId) {
      const { data: segment } = await admin.from("marketing_segments").select("name,filters").eq("id", segmentId).maybeSingle();
      if (!segment) return response({ error: "El segmento ya no existe." }, 404, origin);
      filters = normalizeSegmentFilters(segment.filters);
      segmentName = segment.name;
    }
    const { data: campaign } = await admin.from("marketing_campaigns")
      .select("id,status,subject,headline,body,button_label,image_url,target_url,mode,discount_code,utm_campaign,resend_segment_id,batch_group_id")
      .eq("id", id).maybeSingle();
    if (!campaign || campaign.status !== "draft") return response({ error: "El borrador no está disponible." }, 404, origin);
    if (campaign.batch_group_id) return response({ error: "Esta campaña ya está dividida en tandas." }, 409, origin);
    if (campaign.resend_segment_id) return response({ error: "Guardá de nuevo el borrador antes de dividirlo en tandas." }, 409, origin);
    const emails: string[] = [];
    for (let page = 0; page < 10; page += 1) {
      const result = await segmentRows(filters, "email").range(page * 500, page * 500 + 499);
      if (result.error) return response({ error: "No se pudo leer el segmento." }, 500, origin);
      emails.push(...(result.data || []).map((row) => row.email));
      if ((result.data || []).length < 500) break;
    }
    if (!emails.length) return response({ error: "Ninguna persona cumple con este segmento." }, 400, origin);
    const batches = splitIntoBatches(emails, batchSize);
    if (batches.length > 60) return response({ error: "Son demasiadas tandas. Aumentá el tamaño de la tanda." }, 400, origin);
    const groupId = crypto.randomUUID();
    const utmCampaign = campaign.utm_campaign || campaignUtm(campaign.subject);
    const group = { batch_group_id: groupId, batch_total: batches.length, segment_name: segmentName, audience_mode: "selected", utm_campaign: utmCampaign };
    const content = { subject: campaign.subject, headline: campaign.headline, body: campaign.body, button_label: campaign.button_label, image_url: campaign.image_url, target_url: campaign.target_url, mode: campaign.mode, discount_code: campaign.discount_code };
    if (batches.length > 1) {
      const inserted = await admin.from("marketing_campaigns").insert(batches.slice(1).map((batch, index) => ({ ...content, ...group, batch_number: index + 2, selected_emails: batch, created_by: actorId })));
      if (inserted.error) return response({ error: "No se pudieron crear las tandas." }, 500, origin);
    }
    const first = await admin.from("marketing_campaigns").update({ ...group, batch_number: 1, selected_emails: batches[0], recipient_count: null })
      .eq("id", id).eq("status", "draft").select("id").maybeSingle();
    if (first.error || !first.data) {
      await admin.from("marketing_campaigns").delete().eq("batch_group_id", groupId);
      return response({ error: "No se pudo dividir el borrador." }, 500, origin);
    }
    return response({ groupId, total: emails.length, batches: batches.map((batch) => batch.length) }, 200, origin);
  }
  if (action === "rebatchCampaigns") {
    const id = clean(body.id, 36);
    const count = Math.floor(Number(body.batches));
    if (!(count >= 1 && count <= 60)) return response({ error: "Elegí entre 1 y 60 tandas." }, 400, origin);
    const { data: campaign } = await admin.from("marketing_campaigns")
      .select("id,status,batch_group_id,subject,headline,body,button_label,image_url,target_url,mode,discount_code,utm_campaign,segment_name")
      .eq("id", id).maybeSingle();
    if (!campaign || campaign.status !== "draft" || !campaign.batch_group_id) return response({ error: "Esta campaña no tiene tandas pendientes." }, 409, origin);
    const { data: drafts, error: draftsError } = await admin.from("marketing_campaigns").select("id,batch_number,selected_emails,resend_segment_id")
      .eq("batch_group_id", campaign.batch_group_id).eq("status", "draft").order("batch_number");
    const { count: finished } = await admin.from("marketing_campaigns").select("id", { count: "exact", head: true })
      .eq("batch_group_id", campaign.batch_group_id).neq("status", "draft");
    if (draftsError || !drafts?.length) return response({ error: "No se pudieron leer las tandas." }, 500, origin);
    // Se reparten las personas de las tandas pendientes, en el mismo orden, entre la cantidad elegida.
    const emails = drafts.flatMap((draft) => (draft.selected_emails || []) as string[]);
    if (count > emails.length) return response({ error: "Hay menos personas que tandas." }, 400, origin);
    const base = Math.floor(emails.length / count), extra = emails.length % count;
    const parts: string[][] = [];
    let offset = 0;
    for (let index = 0; index < count; index += 1) {
      const size = base + (index < extra ? 1 : 0);
      parts.push(emails.slice(offset, offset + size));
      offset += size;
    }
    const prepared = drafts.filter((draft) => draft.resend_segment_id);
    if (prepared.length) {
      try {
        const { apiKey } = await resendConfig(async () => await admin.rpc("get_email_delivery_config"));
        for (const draft of prepared) {
          const removed = await fetch(`https://api.resend.com/segments/${encodeURIComponent(draft.resend_segment_id)}`, { method: "DELETE", headers: resendHeaders(apiKey) });
          if (!removed.ok && removed.status !== 404) throw new Error("segment");
        }
      } catch { return response({ error: "No se pudo liberar el público preparado en Resend. Intentá nuevamente." }, 502, origin); }
    }
    const cleared = await admin.from("marketing_campaign_targets").delete().in("campaign_id", drafts.map((draft) => draft.id));
    if (cleared.error) return response({ error: "No se pudo actualizar los destinatarios preparados." }, 500, origin);
    const done = finished || 0;
    const total = done + count;
    for (let index = 0; index < count; index += 1) {
      const row = { batch_number: done + index + 1, batch_total: total, selected_emails: parts[index], recipient_count: null, resend_segment_id: null };
      const draft = drafts[index];
      const saved = draft
        ? await admin.from("marketing_campaigns").update(row).eq("id", draft.id).eq("status", "draft")
        : await admin.from("marketing_campaigns").insert({ ...row, subject: campaign.subject, headline: campaign.headline, body: campaign.body, button_label: campaign.button_label, image_url: campaign.image_url, target_url: campaign.target_url, mode: campaign.mode, discount_code: campaign.discount_code, utm_campaign: campaign.utm_campaign, segment_name: campaign.segment_name, audience_mode: "selected", batch_group_id: campaign.batch_group_id, created_by: actorId });
      if (saved.error) return response({ error: "No se pudieron reorganizar las tandas. Volvé a intentar." }, 500, origin);
    }
    const surplus = drafts.slice(count).map((draft) => draft.id);
    if (surplus.length) {
      const removed = await admin.from("marketing_campaigns").delete().in("id", surplus).eq("status", "draft");
      if (removed.error) return response({ error: "No se pudieron quitar las tandas sobrantes. Volvé a intentar." }, 500, origin);
    }
    if (done) await admin.from("marketing_campaigns").update({ batch_total: total }).eq("batch_group_id", campaign.batch_group_id).neq("status", "draft");
    return response({ batches: parts.map((part) => part.length) }, 200, origin);
  }
  if (action === "deleteCampaignDraft") {
    const { data: campaign } = await admin.from("marketing_campaigns").select("id,status,batch_group_id").eq("id", clean(body.id, 36)).maybeSingle();
    if (!campaign || campaign.status !== "draft") return response({ error: "Solo se pueden eliminar borradores." }, 409, origin);
    const wholeGroup = body.scope === "group" && campaign.batch_group_id;
    const { data: drafts } = wholeGroup
      ? await admin.from("marketing_campaigns").select("id,resend_segment_id").eq("batch_group_id", campaign.batch_group_id).eq("status", "draft")
      : await admin.from("marketing_campaigns").select("id,resend_segment_id").eq("id", campaign.id);
    const withSegment = (drafts || []).filter((draft) => draft.resend_segment_id);
    if (withSegment.length) {
      try {
        const { apiKey } = await resendConfig(async () => await admin.rpc("get_email_delivery_config"));
        for (const draft of withSegment) {
          const removed = await fetch(`https://api.resend.com/segments/${encodeURIComponent(draft.resend_segment_id)}`, { method: "DELETE", headers: resendHeaders(apiKey) });
          if (!removed.ok && removed.status !== 404) throw new Error("segment");
        }
      } catch { return response({ error: "No se pudo liberar el público preparado en Resend. Intentá nuevamente." }, 502, origin); }
    }
    const removed = await admin.from("marketing_campaigns").delete().in("id", (drafts || []).map((draft) => draft.id)).eq("status", "draft");
    return removed.error ? response({ error: "No se pudo eliminar el borrador." }, 500, origin) : response({ ok: true, removed: (drafts || []).length }, 200, origin);
  }
  if (action === "campaigns") {
    const { data, error } = await admin.from("marketing_campaigns").select("id,subject,headline,body,button_label,image_url,target_url,mode,audience_mode,selected_emails,recipient_count,resend_broadcast_id,status,created_at,sent_at,batch_group_id,batch_number,batch_total,segment_name,discount_code,utm_campaign").order("created_at", { ascending: false }).limit(100);
    return error ? response({ error: "No se pudieron cargar las campañas." }, 500, origin) : response({ campaigns: data }, 200, origin);
  }
  if (action === "campaignAudience") {
    const page = Math.max(0, Math.min(10000, Math.floor(Number(body.page) || 0)));
    const query = clean(body.query, 100).replace(/[%_,().]/g, "");
    let request = admin.from("marketing_campaign_email_directory").select("email,name,subscription_status", { count: "exact" })
      .not("email", "is", null).neq("subscription_status", "unsubscribed").order("email");
    if (query) request = request.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
    const [pageResult, totalResult] = await Promise.all([
      request.range(page * 12, page * 12 + 11),
      admin.from("marketing_campaign_email_directory").select("email", { count: "exact", head: true }).neq("subscription_status", "unsubscribed"),
    ]);
    if (pageResult.error || totalResult.error) return response({ error: "No se pudieron cargar los destinatarios." }, 500, origin);
    return response({ contacts: pageResult.data || [], count: pageResult.count || 0, total: totalResult.count || 0 }, 200, origin);
  }
  if (action === "sentCampaigns" || action === "campaignDetail") {
    let config;
    try { config = await resendConfig(async () => await admin.rpc("get_email_delivery_config")); } catch (error) { return response({ error: (error as Error).message }, 503, origin); }
    if (action === "campaignDetail") {
      const id = clean(body.broadcastId, 80);
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return response({ error: "Campaña inválida." }, 400, origin);
      try {
        const item = await resendJson(config.apiKey, `/broadcasts/${encodeURIComponent(id)}`);
        return response({ subject: item.subject, html: item.html || "", text: item.text || "" }, 200, origin);
      } catch { return response({ error: "No se pudo cargar el correo enviado." }, 502, origin); }
    }
    const { data: local, error: localError } = await admin.from("marketing_campaigns")
      .select("id,subject,headline,body,button_label,image_url,target_url,mode,audience_mode,recipient_count,resend_broadcast_id,status,created_at,sent_at,batch_number,batch_total,segment_name,discount_code,utm_campaign")
      .in("status", ["sent", "sending"]).order("created_at", { ascending: false });
    if (localError) return response({ error: "No se pudo cargar el historial." }, 500, origin);
    try {
      const broadcasts: Record<string, unknown>[] = [];
      let after = "";
      for (let page = 0; page < 100; page += 1) {
        const params = new URLSearchParams({ limit: "100", ...(after ? { after } : {}) });
        const result = await resendJson(config.apiKey, `/broadcasts?${params}`) as { data?: Record<string, unknown>[]; has_more?: boolean };
        const rows = Array.isArray(result.data) ? result.data : [];
        broadcasts.push(...rows);
        if (!result.has_more || !rows.length) break;
        after = String(rows.at(-1)?.id || "");
        if (page === 99) return response({ error: "El historial de Resend es demasiado grande para cargarlo completo." }, 502, origin);
      }
      const sent = broadcasts.filter((item) => item.status === "sent" || item.status === "queued");
      const knownIds = new Set((local || []).map((item) => item.resend_broadcast_id).filter(Boolean));
      const subjects = new Map<string, string>();
      const external = sent.filter((item) => !knownIds.has(String(item.id)));
      for (let offset = 0; offset < external.length; offset += 2) {
        const batch = await Promise.allSettled(external.slice(offset, offset + 2).map((item) =>
          resendJson(config.apiKey, `/broadcasts/${encodeURIComponent(String(item.id))}`) as Promise<{ subject?: string }>));
        batch.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value.subject) subjects.set(String(external[offset + index].id), result.value.subject);
        });
      }
      const counts = new Map<string, number>();
      for (let offset = 0; offset < sent.length; offset += 100) {
        const group = sent.slice(offset, offset + 100);
        const ids = group.map((item) => String(item.id));
        const first = group.map((item) => String(item.sent_at || item.created_at || "").slice(0, 10)).filter(Boolean).sort()[0];
        const params = new URLSearchParams({ start_date: first || new Date().toISOString().slice(0, 10), end_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), metrics: "sent", dimensions: "broadcast", broadcast_id: ids.join(",") });
        try {
          const metrics = await resendJson(config.apiKey, `/emails/metrics?${params}`) as { data?: { broadcast_id?: string; sent?: number }[] };
          for (const item of metrics.data || []) if (item.broadcast_id && typeof item.sent === "number") counts.set(item.broadcast_id, item.sent);
        } catch { /* The history still works when metrics are unavailable. */ }
      }
      // Las métricas de Resend no siempre traen el total: para los envíos que Gestión no registró se cuentan los destinatarios enviados.
      const recipientCounts = new Map<string, number>();
      for (const item of external.slice(0, 15)) {
        try {
          let total = 0;
          let afterRecipient = "";
          for (let page = 0; page < 10; page += 1) {
            const params = new URLSearchParams({ type: "sent", limit: "100", ...(afterRecipient ? { after: afterRecipient } : {}) });
            const list = await resendJson(config.apiKey, `/broadcasts/${encodeURIComponent(String(item.id))}/recipients?${params}`) as { data?: { id?: string }[]; has_more?: boolean };
            const rows = Array.isArray(list.data) ? list.data : [];
            total += rows.length;
            if (!list.has_more || !rows.length) break;
            afterRecipient = String(rows.at(-1)?.id || "");
          }
          recipientCounts.set(String(item.id), total);
        } catch { /* Queda "sin dato" para este envío. */ }
      }
      const known = new Map((local || []).filter((item) => item.resend_broadcast_id).map((item) => [item.resend_broadcast_id, item]));
      for (const item of sent) {
        const own = known.get(String(item.id));
        if (own?.status === "sending" && item.status === "sent") {
          await systemAdmin.from("marketing_campaigns").update({ status: "sent", sent_at: item.sent_at || new Date().toISOString() }).eq("id", own.id).eq("status", "sending");
        }
      }
      const history = sent.map((item) => {
        const id = String(item.id);
        const own = known.get(id);
        return { id: own?.id || id, broadcast_id: id, subject: own?.subject || subjects.get(id) || item.name || "Campaña", sent_at: item.sent_at || own?.sent_at || item.created_at,
          audience_mode: own?.audience_mode || "external", recipient_count: own?.recipient_count ?? recipientCounts.get(id) ?? (counts.get(id) || null), status: item.status, source: own ? "gestion" : "resend",
          batch_number: own?.batch_number ?? null, batch_total: own?.batch_total ?? null, segment_name: own?.segment_name ?? null };
      });
      for (const item of local || []) if (!item.resend_broadcast_id || !sent.some((entry) => entry.id === item.resend_broadcast_id)) {
        history.push({ id: item.id, broadcast_id: item.resend_broadcast_id || "", subject: item.subject, sent_at: item.sent_at || item.created_at,
          audience_mode: item.audience_mode, recipient_count: item.recipient_count, status: item.status, source: "gestion",
          batch_number: item.batch_number ?? null, batch_total: item.batch_total ?? null, segment_name: item.segment_name ?? null });
      }
      history.sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at)));
      return response({ campaigns: history, count: history.filter((item) => item.status === "sent").length }, 200, origin);
    } catch { return response({ error: "No se pudo cargar el historial de Resend." }, 502, origin); }
  }
  if (action === "settings") {
    const { data, error } = await admin.from("marketing_subscription_settings").select("enabled,headline,description,image_url,discount_code").eq("id", true).single();
    return error ? response({ error: "No se pudo cargar la suscripción." }, 500, origin) : response({ settings: data }, 200, origin);
  }
  if (action === "saveSettings") {
    const code = clean(body.discountCode, 32).toUpperCase();
    const headline = clean(body.headline, 120), description = clean(body.description, 300);
    const imageUrl = safeUrl(clean(body.imageUrl, 1000)) || null;
    if (!headline || !description || !code || (body.imageUrl && !imageUrl)) return response({ error: "Completá el mensaje y el código; la imagen debe tener un enlace seguro." }, 400, origin);
    if (body.enabled) {
      const { data: discount } = await admin.from("commerce_discounts").select("discount_type,value,enabled,valid_from,valid_until,welcome_only").eq("code", code).maybeSingle();
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      if (!discount || !discount.enabled || !discount.welcome_only || discount.discount_type !== "percentage" || Number(discount.value) !== 10 || discount.valid_from > today || discount.valid_until < today) {
        return response({ error: "Primero creá y habilitá un descuento vigente del 10% para la primera compra." }, 400, origin);
      }
    }
    const { error } = await admin.from("marketing_subscription_settings").update({ enabled: body.enabled === true, headline, description, image_url: imageUrl, discount_code: code, updated_at: new Date().toISOString() }).eq("id", true);
    return error ? response({ error: "No se pudo guardar la suscripción." }, 500, origin) : response({ ok: true }, 200, origin);
  }
  if (action === "saveCampaign") {
    const subject = clean(body.subject, 160), message = clean(body.message, 10000);
    const headline = clean(body.headline, 180) || subject;
    const buttonLabel = clean(body.buttonLabel, 60) || null;
    const imageUrl = safeUrl(clean(body.imageUrl, 1000)) || null;
    const targetUrl = safeUrl(clean(body.targetUrl, 1000)) || null;
    const mode = body.mode === "image" ? "image" : "message";
    const id = clean(body.id, 36);
    const { data: existing } = id
      ? await admin.from("marketing_campaigns").select("resend_segment_id,status,batch_group_id,utm_campaign,selected_emails").eq("id", id).maybeSingle()
      : { data: null };
    if (id && (!existing || existing.status !== "draft")) return response({ error: "Este borrador ya no se puede editar." }, 409, origin);
    // Una tanda conserva sus destinatarios: solo se edita el contenido, que se comparte con las demás tandas.
    const inBatch = Boolean(existing?.batch_group_id);
    const audienceMode = inBatch || body.audienceMode === "selected" ? "selected" : "all";
    const selectedEmails = inBatch ? (existing?.selected_emails || []) as string[] : Array.isArray(body.selectedEmails) ? [...new Set(body.selectedEmails.map((value) => clean(value, 320).toLowerCase()).filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))] : [];
    const discountCode = clean(body.discountCode, 32).toUpperCase();
    if (discountCode) {
      const { data: discount } = await admin.from("commerce_discounts").select("id").eq("code", discountCode).eq("enabled", true).maybeSingle();
      if (!discount) return response({ error: "El descuento elegido no está disponible." }, 400, origin);
    }
    const utmCampaign = existing?.utm_campaign || campaignUtm(subject);
    if (!subject || (mode === "message" && !message) || (mode === "image" && !imageUrl) || (audienceMode === "selected" && !selectedEmails.length) || (body.imageUrl && !imageUrl) || (body.targetUrl && !targetUrl)) {
      return response({ error: "Completá el asunto, el contenido y los destinatarios; los enlaces deben ser seguros." }, 400, origin);
    }
    if (id) {
      if (existing?.resend_segment_id) {
        try {
          const { apiKey } = await resendConfig(async () => await admin.rpc("get_email_delivery_config"));
          const removed = await fetch(`https://api.resend.com/segments/${encodeURIComponent(existing.resend_segment_id)}`, { method: "DELETE", headers: resendHeaders(apiKey) });
          if (!removed.ok && removed.status !== 404) return response({ error: "No se pudo reemplazar el público preparado. Intentá nuevamente." }, 502, origin);
        } catch { return response({ error: "No se pudo reemplazar el público preparado. Intentá nuevamente." }, 502, origin); }
      }
      const cleared = await admin.from("marketing_campaign_targets").delete().eq("campaign_id", id);
      if (cleared.error) return response({ error: "No se pudo actualizar el borrador." }, 500, origin);
    }
    const result = id
      ? await admin.from("marketing_campaigns").update({ subject, headline: mode === "image" ? null : headline, body: mode === "image" ? "" : message, button_label: mode === "image" ? null : buttonLabel, image_url: imageUrl, target_url: targetUrl, mode, audience_mode: audienceMode, selected_emails: selectedEmails, recipient_count: null, resend_segment_id: null, discount_code: discountCode || null, utm_campaign: utmCampaign }).eq("id", id).eq("status", "draft").select("id").maybeSingle()
      : await admin.from("marketing_campaigns").insert({ subject, headline: mode === "image" ? null : headline, body: mode === "image" ? "" : message, button_label: mode === "image" ? null : buttonLabel, image_url: imageUrl, target_url: targetUrl, mode, audience_mode: audienceMode, selected_emails: selectedEmails, discount_code: discountCode || null, utm_campaign: utmCampaign, created_by: actorId }).select("id").single();
    if (result.error || !result.data) return response({ error: "No se pudo guardar el borrador." }, 400, origin);
    if (inBatch && existing?.batch_group_id) {
      const shared = await admin.from("marketing_campaigns").update({ subject, headline: mode === "image" ? null : headline, body: mode === "image" ? "" : message, button_label: mode === "image" ? null : buttonLabel, image_url: imageUrl, target_url: targetUrl, mode, discount_code: discountCode || null })
        .eq("batch_group_id", existing.batch_group_id).eq("status", "draft").neq("id", id);
      if (shared.error) return response({ error: "Se guardó esta tanda, pero no se pudieron actualizar las demás. Guardá de nuevo." }, 500, origin);
    }
    return response({ id: result.data.id }, 200, origin);
  }
  if (action === "prepareCampaign") {
    const id = clean(body.id, 36);
    const { data: campaign, error: campaignError } = await admin.from("marketing_campaigns")
      .select("id,subject,status,audience_mode,selected_emails,resend_segment_id,recipient_count").eq("id", id).maybeSingle();
    if (campaignError || !campaign || !["draft", "sending"].includes(campaign.status)) return response({ error: "Guardá el borrador antes de preparar el envío." }, 409, origin);
    if (campaign.status === "sending") return response({ processed: campaign.recipient_count || 0, remaining: 0, ready: campaign.recipient_count || 0, excluded: 0, done: true }, 200, origin);
    let config;
    try { config = await resendConfig(async () => await admin.rpc("get_email_delivery_config")); } catch (error) { return response({ error: (error as Error).message }, 503, origin); }
    let segmentId = campaign.resend_segment_id as string | null;
    if (!segmentId) {
      await releaseFinishedSegments(systemAdmin, config.apiKey);
      try {
        const segment = await resendJson(config.apiKey, "/segments", { method: "POST", body: JSON.stringify({ name: `MateArte ${campaign.subject.slice(0, 40)} ${id.slice(0, 8)}` }) });
        segmentId = String(segment.id || "");
        if (!segmentId) throw new Error("Resend no devolvió el grupo.");
      } catch { return response({ error: "No se pudo crear el grupo de destinatarios en Resend. Si el plan ya tiene todos sus grupos en uso, esperá a que termine el envío anterior." }, 502, origin); }
      const saved = await admin.from("marketing_campaigns").update({ resend_segment_id: segmentId }).eq("id", id).eq("status", "draft");
      if (saved.error) return response({ error: "No se pudo guardar el grupo de destinatarios." }, 500, origin);
    }
    const { count: existingCount, error: countError } = await admin.from("marketing_campaign_targets").select("email", { count: "exact", head: true }).eq("campaign_id", id);
    if (countError) return response({ error: "No se pudieron preparar los destinatarios." }, 500, origin);
    if (!existingCount) {
      const wanted = campaign.audience_mode === "selected" ? new Set<string>(campaign.selected_emails || []) : null;
      const targets: { campaign_id: string; email: string; name: string | null }[] = [];
      for (let page = 0; ; page += 1) {
        const { data, error } = await admin.from("marketing_campaign_email_directory").select("email,name,subscription_status")
          .not("email", "is", null).neq("subscription_status", "unsubscribed").order("email").range(page * 500, page * 500 + 499);
        if (error) return response({ error: "No se pudo leer el directorio de contactos." }, 500, origin);
        for (const contact of (data || []) as MarketingContact[]) if (contact.email && (!wanted || wanted.has(contact.email))) targets.push({ campaign_id: id, email: contact.email, name: contact.name });
        if (!data || data.length < 500) break;
      }
      if (!targets.length) return response({ error: "No hay destinatarios disponibles para esta campaña." }, 400, origin);
      for (let index = 0; index < targets.length; index += 500) {
        const inserted = await admin.from("marketing_campaign_targets").upsert(targets.slice(index, index + 500), { onConflict: "campaign_id,email", ignoreDuplicates: true });
        if (inserted.error) return response({ error: "No se pudieron guardar los destinatarios." }, 500, origin);
      }
    }
    const { data: pending, error: pendingError } = await admin.from("marketing_campaign_targets").select("email,name")
      .eq("campaign_id", id).eq("status", "pending").order("email").limit(5);
    if (pendingError) return response({ error: "No se pudo continuar la preparación." }, 500, origin);
    for (const contact of pending || []) {
      const address = encodeURIComponent(contact.email);
      try {
        const suppression = await fetch(`https://api.resend.com/suppressions/${address}`, { headers: resendHeaders(config.apiKey) });
        if (suppression.ok) {
          const excluded = await admin.from("marketing_campaign_targets").update({ status: "excluded" }).eq("campaign_id", id).eq("email", contact.email);
          if (excluded.error) throw new Error("No se pudo registrar una exclusión.");
          continue;
        }
        if (suppression.status !== 404) throw new Error("No se pudo verificar una supresión.");
        const existing = await fetch(`https://api.resend.com/contacts/${address}`, { headers: resendHeaders(config.apiKey) });
        if (existing.status === 404) {
          await resendJson(config.apiKey, "/contacts", { method: "POST", body: JSON.stringify({ email: contact.email, first_name: contact.name?.slice(0, 50) || undefined, unsubscribed: false, topics: [{ id: config.topicId, subscription: "opt_in" }] }) });
        } else if (existing.ok) {
          const provider = await existing.json() as { unsubscribed?: boolean };
          const subscriptions: { id: string; subscription: string }[] = [];
          let afterTopic = "";
          for (let page = 0; page < 100; page += 1) {
            const params = new URLSearchParams({ limit: "100", ...(afterTopic ? { after: afterTopic } : {}) });
            const topics = await resendJson(config.apiKey, `/contacts/${address}/topics?${params}`) as { data?: { id: string; subscription: string }[]; has_more?: boolean };
            const rows = topics.data || [];
            subscriptions.push(...rows);
            if (!topics.has_more || !rows.length) break;
            afterTopic = rows.at(-1)?.id || "";
            if (page === 99) throw new Error("No se pudieron revisar todas las bajas.");
          }
          if (provider.unsubscribed || subscriptions.some((topic) => topic.id === config.topicId && topic.subscription === "opt_out")) {
            const registered = await admin.from("marketing_unsubscribes").upsert({ email: contact.email }, { onConflict: "email", ignoreDuplicates: true });
            if (registered.error) throw new Error("No se pudo registrar una baja.");
            const excluded = await admin.from("marketing_campaign_targets").update({ status: "excluded" }).eq("campaign_id", id).eq("email", contact.email);
            if (excluded.error) throw new Error("No se pudo registrar una exclusión.");
            continue;
          }
          if (!subscriptions.some((topic) => topic.id === config.topicId)) await resendJson(config.apiKey, `/contacts/${address}/topics`, { method: "PATCH", body: JSON.stringify({ topics: [{ id: config.topicId, subscription: "opt_in" }] }) });
        } else throw new Error("No se pudo verificar un contacto.");
        const added = await fetch(`https://api.resend.com/contacts/${address}/segments/${encodeURIComponent(segmentId)}`, { method: "POST", headers: resendHeaders(config.apiKey) });
        if (!added.ok && added.status !== 409) throw new Error("No se pudo agregar un contacto al grupo.");
        const updated = await admin.from("marketing_campaign_targets").update({ status: "ready" }).eq("campaign_id", id).eq("email", contact.email);
        if (updated.error) throw new Error("No se pudo registrar un destinatario.");
      } catch { return response({ error: `No se pudo preparar ${contact.email}. Reintentá el envío.`, retryable: true }, 502, origin); }
    }
    const [remaining, ready, excluded] = await Promise.all([
      admin.from("marketing_campaign_targets").select("email", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "pending"),
      admin.from("marketing_campaign_targets").select("email", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "ready"),
      admin.from("marketing_campaign_targets").select("email", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "excluded"),
    ]);
    if (remaining.error || ready.error || excluded.error) return response({ error: "No se pudo contar el público preparado." }, 500, origin);
    return response({ processed: (ready.count || 0) + (excluded.count || 0), remaining: remaining.count || 0, ready: ready.count || 0, excluded: excluded.count || 0, done: !remaining.count }, 200, origin);
  }
  if (action === "syncContacts") {
    let apiKey = Deno.env.get("RESEND_API_KEY")?.trim() || "";
    const segmentId = Deno.env.get("RESEND_MARKETING_SEGMENT_ID") || "";
    let topicId = Deno.env.get("RESEND_NEWSLETTER_TOPIC_ID")?.trim() || "";
    if (!apiKey || !topicId) {
      const { data, error } = await admin.rpc("get_email_delivery_config");
      if (error) return response({ error: "No se pudo leer la configuración del correo." }, 500, origin);
      const config = (data || {}) as Record<string, string>;
      apiKey ||= config.matearte_resend_api_key || "";
      topicId ||= config.matearte_newsletter_topic_id || "";
    }
    if (!apiKey || !segmentId || !topicId) return response({ error: "Configurá el grupo de suscriptores de Resend antes de enviar." }, 503, origin);
    const batchSize = 5;
    const { data: contacts, count, error } = await admin.from("newsletter_subscribers")
      .select("email,first_name,status", { count: "exact" }).is("marketing_synced_at", null).order("id").limit(batchSize);
    if (error) return response({ error: "No se pudo preparar la lista de contactos." }, 500, origin);
    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
    for (const contact of contacts || []) {
      const address = encodeURIComponent(contact.email);
      const segmentUrl = `https://api.resend.com/contacts/${address}/segments/${encodeURIComponent(segmentId)}`;
      if (contact.status !== "active") {
        const removed = await fetch(segmentUrl, { method: "DELETE", headers });
        if (!removed.ok && removed.status !== 404) return response({ error: "No se pudo actualizar una baja en Resend." }, 502, origin);
      } else {
        const existing = await fetch(`https://api.resend.com/contacts/${address}`, { headers });
        if (existing.status === 404) {
          const created = await fetch("https://api.resend.com/contacts", { method: "POST", headers,
            body: JSON.stringify({ email: contact.email, first_name: contact.first_name || undefined, unsubscribed: false, topics: [{ id: topicId, subscription: "opt_in" }] }) });
          if (!created.ok) return response({ error: "No se pudo crear un contacto en Resend." }, 502, origin);
        } else if (existing.ok) {
          const providerContact = await existing.json().catch(() => ({}));
          if (providerContact.unsubscribed) {
            const removed = await fetch(segmentUrl, { method: "DELETE", headers });
            if (!removed.ok && removed.status !== 404) return response({ error: "No se pudo respetar una baja en Resend." }, 502, origin);
            const { error: saveError } = await admin.from("newsletter_subscribers").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString(), marketing_synced_at: new Date().toISOString() }).eq("email", contact.email);
            if (saveError) return response({ error: "No se pudo registrar una baja de Resend." }, 500, origin);
            continue;
          }
        } else return response({ error: "No se pudo verificar un contacto en Resend." }, 502, origin);
        const added = await fetch(segmentUrl, { method: "POST", headers });
        if (!added.ok && added.status !== 409) return response({ error: "No se pudo incluir un suscriptor en la campaña." }, 502, origin);
      }
      const { error: saveError } = await admin.from("newsletter_subscribers").update({ marketing_synced_at: new Date().toISOString() }).eq("email", contact.email);
      if (saveError) return response({ error: "No se pudo registrar la preparación del contacto." }, 500, origin);
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
    return response({ processed: contacts?.length || 0, remaining: Math.max(0, (count || 0) - (contacts?.length || 0)), done: (count || 0) <= batchSize }, 200, origin);
  }
  if (action === "testCampaign" || action === "sendCampaign") {
    const id = clean(body.id, 36);
    const { data: campaign } = await admin.from("marketing_campaigns")
      .select("id,subject,headline,body,button_label,image_url,target_url,mode,status,resend_segment_id,resend_broadcast_id,recipient_count,send_attempted_at,discount_code,utm_campaign")
      .eq("id", id).maybeSingle();
    if (!campaign || (campaign.status !== "draft" && campaign.status !== "sending")) return response({ error: "El borrador no está disponible." }, 404, origin);
    let config;
    try { config = await resendConfig(async () => await admin.rpc("get_email_delivery_config")); } catch (error) { return response({ error: (error as Error).message }, 503, origin); }
    const isTest = action === "testCampaign";
    const testEmail = clean(body.testEmail, 320);
    if (isTest && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) return response({ error: "Ingresá un correo de prueba válido." }, 400, origin);
    if (isTest) {
      if (campaign.status !== "draft") return response({ error: "La campaña ya se está enviando." }, 409, origin);
      try {
        const result = await resendJson(config.apiKey, "/emails", { method: "POST", headers: { "Idempotency-Key": `matearte-test-${id}-${crypto.randomUUID()}` },
          body: JSON.stringify({ from: config.from, to: [testEmail], subject: `[Prueba] ${campaign.subject}`, html: marketingCampaignHtml(campaign, true) }) });
        return response({ ok: true, id: result.id || null }, 200, origin);
      } catch { return response({ error: "No se pudo enviar el correo de prueba." }, 502, origin); }
    }
    if (!campaign.resend_segment_id) return response({ error: "Prepará los destinatarios antes de enviar." }, 400, origin);
    let broadcastId = campaign.resend_broadcast_id as string | null;
    if (campaign.status === "draft") {
      const [pending, ready] = await Promise.all([
        admin.from("marketing_campaign_targets").select("email", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "pending"),
        admin.from("marketing_campaign_targets").select("email", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "ready"),
      ]);
      if (pending.error || ready.error || pending.count || !ready.count) return response({ error: "Terminá de preparar el público antes de enviar." }, 400, origin);
      const { data: claimed, error: claimError } = await admin.from("marketing_campaigns")
        .update({ status: "sending", recipient_count: ready.count, send_requested_at: new Date().toISOString() })
        .eq("id", id).eq("status", "draft").select("id").maybeSingle();
      if (claimError || !claimed) return response({ error: "Esta campaña ya se está enviando." }, 409, origin);
    }
    const providerName = `MateArte ${id}`;
    if (!broadcastId) {
      try {
        const list = await resendJson(config.apiKey, "/broadcasts") as { data?: { id: string; name: string }[] };
        broadcastId = list.data?.find((item) => item.name === providerName)?.id || null;
        if (!broadcastId) {
          const created = await resendJson(config.apiKey, "/broadcasts", { method: "POST", body: JSON.stringify({
            segment_id: campaign.resend_segment_id, from: config.from, subject: campaign.subject,
            html: marketingCampaignHtml(campaign), name: providerName,
          }) });
          broadcastId = String(created.id || "");
        }
        if (!broadcastId) throw new Error("Resend no devolvió el identificador.");
        const saved = await admin.from("marketing_campaigns").update({ resend_broadcast_id: broadcastId }).eq("id", id).eq("status", "sending");
        if (saved.error) throw new Error("No se pudo registrar la campaña.");
      } catch { return response({ error: "No se confirmó la creación en Resend. Volvé a consultar esta campaña antes de reintentar." }, 502, origin); }
    }
    try {
      const current = await resendJson(config.apiKey, `/broadcasts/${encodeURIComponent(broadcastId)}`) as { status?: string; sent_at?: string };
      if (current.status === "sent") {
        await admin.from("marketing_campaigns").update({ status: "sent", sent_at: current.sent_at || new Date().toISOString() }).eq("id", id).eq("status", "sending");
        return response({ ok: true, status: "sent", id: broadcastId }, 200, origin);
      }
      if (current.status === "queued") return response({ ok: true, status: "sending", id: broadcastId }, 200, origin);
      if (current.status !== "draft") return response({ error: "El estado de la campaña en Resend requiere revisión antes de reintentar." }, 409, origin);
      if (campaign.send_attempted_at) return response({ error: "Ya se solicitó el envío. Revisá su estado en Resend antes de volver a intentarlo." }, 409, origin);
      const attempted = await admin.from("marketing_campaigns").update({ send_attempted_at: new Date().toISOString() })
        .eq("id", id).eq("status", "sending").is("send_attempted_at", null).select("id").maybeSingle();
      if (attempted.error || !attempted.data) return response({ error: "El envío ya fue solicitado. Consultá su estado antes de reintentar." }, 409, origin);
      await resendJson(config.apiKey, `/broadcasts/${encodeURIComponent(broadcastId)}/send`, { method: "POST", body: "{}" });
      return response({ ok: true, status: "sending", id: broadcastId }, 200, origin);
    } catch { return response({ error: "No se confirmó el envío. La campaña quedó registrada; consultá su estado antes de reintentar." }, 502, origin); }
  }
  return response({ error: "Operación desconocida." }, 400, origin);
});
