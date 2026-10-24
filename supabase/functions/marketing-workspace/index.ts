import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const origins = new Set(["http://127.0.0.1:5180", "http://localhost:5180", "http://127.0.0.1:5181", "http://localhost:5181", "https://matearte-gestion.vercel.app", ...(Deno.env.get("GESTION_ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean)]);
const response = (body: unknown, status = 200, origin = "") => new Response(status === 204 ? null : JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json", "Cache-Control": "no-store",
    ...(origins.has(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" } : {}),
  },
});
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
const safeUrl = (value: string) => {
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : ""; } catch { return ""; }
};

function campaignHtml(campaign: { subject: string; body: string; image_url: string | null; target_url: string | null }, test = false) {
  const image = campaign.image_url ? `<img src="${escapeHtml(campaign.image_url)}" alt="" width="600" style="display:block;max-width:100%;height:auto;margin:0 auto 24px;border:0">` : "";
  const content = `${image}<h2>${escapeHtml(campaign.subject)}</h2>${campaign.body.split(/\n{2,}/).map((part) => `<p style="line-height:1.6">${escapeHtml(part).replace(/\n/g, "<br>")}</p>`).join("")}`;
  // Todo el contenido (foto, asunto y mensaje) lleva al enlace de la promoción.
  const linked = campaign.target_url ? `<a href="${escapeHtml(campaign.target_url)}" style="display:block;color:inherit;text-decoration:none">${content}</a>` : content;
  const footer = test ? "Esta es una prueba de la campaña." : '<a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#695950">Cancelar suscripción</a>';
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f0e8;color:#302018;font-family:Arial,sans-serif"><main style="max-width:600px;margin:auto;padding:32px;background:#fffdf9"><h1 style="font-family:Georgia,serif">Matearte</h1>${linked}<p style="margin-top:36px;font-size:11px;color:#695950">${footer}</p></main></body></html>`;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") return origins.has(origin) ? response({}, 204, origin) : response({ error: "Origen no permitido." }, 403, origin);
  if (request.method !== "POST" || (origin && !origins.has(origin))) return response({ error: "Solicitud no permitida." }, 403, origin);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!token) return response({ error: "Falta la sesión." }, 401, origin);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return response({ error: "Servicio no configurado." }, 503, origin);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return response({ error: "Sesión inválida." }, 401, origin);
  const { data: membership } = await admin.from("commerce_admin_users").select("active,access_user_id,allowed_paths").eq("user_id", user.id).maybeSingle();
  if (!membership?.active) return response({ error: "Sin acceso." }, 403, origin);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return response({ error: "Solicitud inválida." }, 400, origin); }
  const action = clean(body.action, 30);
  const route = action === "contacts" ? "/marketing/contactos" : action === "analytics" ? "/marketing/analytics" : action === "metrics" ? "/marketing/metricas" : action === "settings" || action === "saveSettings" ? "/marketing/suscripcion" : "/marketing/campanas";
  if (membership.access_user_id !== "t1" && !membership.allowed_paths?.includes(route)) return response({ error: "No tenés acceso a esta pestaña." }, 403, origin);

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
    let contactsQuery = admin.from("marketing_contact_directory")
      .select("id,name,email,phone,source,created_at,has_account,subscription_status", { count: "exact" })
      .not("email", "is", null)
      .order("created_at", { ascending: false });
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
    since.setUTCHours(0, 0, 0, 0);
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
  if (action === "campaigns") {
    const { data, error } = await admin.from("marketing_campaigns").select("id,subject,body,image_url,target_url,status,created_at,sent_at").order("created_at", { ascending: false }).limit(100);
    return error ? response({ error: "No se pudieron cargar las campañas." }, 500, origin) : response({ campaigns: data }, 200, origin);
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
    const imageUrl = safeUrl(clean(body.imageUrl, 1000)) || null;
    const targetUrl = safeUrl(clean(body.targetUrl, 1000)) || null;
    if (!subject || !message || (body.imageUrl && !imageUrl) || (body.targetUrl && !targetUrl)) return response({ error: "Completá asunto y mensaje; los enlaces deben ser seguros." }, 400, origin);
    const id = clean(body.id, 36);
    const result = id
      ? await admin.from("marketing_campaigns").update({ subject, body: message, image_url: imageUrl, target_url: targetUrl }).eq("id", id).eq("status", "draft").select("id").maybeSingle()
      : await admin.from("marketing_campaigns").insert({ subject, body: message, image_url: imageUrl, target_url: targetUrl, created_by: user.id }).select("id").single();
    return result.error || !result.data ? response({ error: "No se pudo guardar el borrador." }, 400, origin) : response({ id: result.data.id }, 200, origin);
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
    const { data: campaign } = await admin.from("marketing_campaigns").select("id,subject,body,image_url,target_url,status").eq("id", id).maybeSingle();
    if (!campaign || campaign.status !== "draft") return response({ error: "El borrador no está disponible." }, 404, origin);
    let apiKey = Deno.env.get("RESEND_API_KEY")?.trim() || "";
    let from = Deno.env.get("MARKETING_EMAIL_FROM")?.trim() || Deno.env.get("NEWSLETTER_EMAIL_FROM")?.trim() || Deno.env.get("COMMERCE_EMAIL_FROM")?.trim() || "";
    const segmentId = Deno.env.get("RESEND_MARKETING_SEGMENT_ID") || "";
    if (!apiKey || !from) {
      const { data, error } = await admin.rpc("get_email_delivery_config");
      if (error) return response({ error: "No se pudo leer la configuración del correo." }, 500, origin);
      const config = (data || {}) as Record<string, string>;
      apiKey ||= config.matearte_resend_api_key || "";
      from ||= config.matearte_email_from || "";
    }
    if (!apiKey || !from || (action === "sendCampaign" && !segmentId)) return response({ error: "Configurá el remitente y el grupo de suscriptores antes de enviar." }, 503, origin);
    const isTest = action === "testCampaign";
    const testEmail = clean(body.testEmail, 320);
    if (isTest && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) return response({ error: "Ingresá un correo de prueba válido." }, 400, origin);
    if (!isTest) {
      const { count: recipients, error: countError } = await admin.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active");
      if (countError || !recipients) return response({ error: "Todavía no hay suscriptores activos para esta campaña." }, 400, origin);
      const { data: claimed } = await admin.from("marketing_campaigns").update({ status: "sending" }).eq("id", id).eq("status", "draft").select("id").maybeSingle();
      if (!claimed) return response({ error: "Esta campaña ya se está enviando." }, 409, origin);
    }
    let res: Response;
    try {
      res = await fetch(`https://api.resend.com/${isTest ? "emails" : "broadcasts"}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(isTest ? { "Idempotency-Key": `matearte-test-${id}-${crypto.randomUUID()}` } : {}) },
        body: JSON.stringify(isTest
          ? { from, to: [testEmail], subject: `[Prueba] ${campaign.subject}`, html: campaignHtml(campaign, true) }
          : { segment_id: segmentId, from, subject: campaign.subject, html: campaignHtml(campaign), send: true }),
      });
    } catch {
      return response({ error: isTest ? "No se pudo conectar con el correo de prueba." : "No se confirmó el envío. Revisá la campaña en Resend antes de volver a intentarlo." }, 502, origin);
    }
    const delivered = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (!isTest && res.status < 500) await admin.from("marketing_campaigns").update({ status: "draft" }).eq("id", id).eq("status", "sending");
      return response({ error: res.status >= 500 && !isTest ? "No se confirmó el envío. Revisá la campaña en Resend antes de volver a intentarlo." : `El proveedor rechazó el envío (${res.status}).` }, 502, origin);
    }
    if (!isTest) await admin.from("marketing_campaigns").update({ status: "sent", resend_broadcast_id: delivered.id || null, sent_at: new Date().toISOString() }).eq("id", id);
    return response({ ok: true, id: delivered.id || null }, 200, origin);
  }
  return response({ error: "Operación desconocida." }, 400, origin);
});
