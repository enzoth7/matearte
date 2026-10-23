import { useCallback, useEffect, useMemo, useState, type ComponentType, type FormEvent, type PointerEvent, type ReactNode } from "react";
import * as flags from "country-flag-icons/react/3x2";
import { commerceSource } from "./commerceSource";
import { customerOriginClass, customerOriginLabel, customerOriginOptions, customerOriginValue } from "./customerChannel";
import { formatDate } from "./dateFormat";
import { CustomerDetailModal } from "./pages";
import type { CommerceSnapshot } from "./commerceAdapter";
import type { Customer, State } from "./data";

type Contact = { id: string; name: string | null; email: string | null; phone: string | null; source: string; created_at: string; has_account: boolean; subscription_status: string };
type ContactSummary = { total: number; origins: { source: string; contacts: number }[] };
type Campaign = { id: string; subject: string; body: string; image_url: string | null; target_url: string | null; status: string; created_at: string; sent_at: string | null };
type Settings = { enabled: boolean; headline: string; description: string; image_url: string | null; discount_code: string };

async function callMarketing<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!commerceSource) throw new Error("El comercio no está conectado.");
  const { data, error } = await commerceSource.functions.invoke("marketing-workspace", { body: { action, ...payload } });
  if (error) {
    const responseBody = error.context instanceof Response
      ? await error.context.json().catch(() => null) as { error?: string } | null
      : null;
    throw new Error(responseBody?.error || error.message || "No se pudo completar la operación.");
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

const date = (value: string | null) => formatDate(value);
const sourceName = customerOriginLabel;
const originBadgeClass = customerOriginClass;

function Contacts({ s, go, commerce }: { s: State; go: (path: string) => void; commerce?: CommerceSnapshot | null }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState<ContactSummary | null>(null);
  const [page, setPage] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const selectedCustomer = useMemo((): Customer | null => {
    if (!selectedContact) return null;
    const email = selectedContact.email?.trim().toLowerCase();
    const phone = selectedContact.phone?.replace(/[^0-9]/g, "");
    const match = s.customers.find((entry) => email
      ? entry.email.trim().toLowerCase() === email
      : phone && entry.phone.replace(/[^0-9]/g, "") === phone);
    return match || {
      id: selectedContact.id, name: selectedContact.name || selectedContact.email || "Contacto sin nombre",
      email: selectedContact.email || "", phone: selectedContact.phone || "", city: "", segment: "Minorista",
    };
  }, [s.customers, selectedContact]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void callMarketing<{ contacts: Contact[]; count: number; summary: ContactSummary }>("contacts", { page, query: applied, source: sourceFilter })
      .then((result) => { if (active) { setContacts(result.contacts); setCount(result.count); setSummary(result.summary); setError(""); } })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, applied, sourceFilter]);
  const selectSource = (source: string | null) => { setPage(0); setSourceFilter((current) => current === source ? null : source); };
  return <div className="marketing-contacts-page">
    {summary && <div className="marketing-contact-kpis" aria-label="Resumen de contactos">
      <button type="button" className="badge marketing-contact-kpi" aria-pressed={sourceFilter === null} onClick={() => selectSource(null)}><strong>{summary.total.toLocaleString("es-UY")}</strong><div>Todos</div></button>
      {customerOriginOptions.map((origin) => {
        const item = (summary.origins || []).find((entry) => customerOriginValue(entry.source) === origin);
        return <button key={origin} type="button" className={`badge ${originBadgeClass(origin)} marketing-contact-kpi`} aria-pressed={sourceFilter === origin} onClick={() => selectSource(origin)}><strong>{(item?.contacts || 0).toLocaleString("es-UY")}</strong><div>{sourceName(origin)}</div></button>;
      })}
    </div>}
    <section className="marketing-directory">
    <div className="marketing-directory-toolbar">
      <form className="marketing-directory-search" onSubmit={(event) => { event.preventDefault(); setPage(0); setApplied(query.trim()); }}>
        <input type="search" aria-label="Buscar contacto" placeholder="Buscar nombre, correo o celular" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="submit" className="secondary">Buscar</button>
      </form>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p role="status">Cargando contactos…</p> : <>
      {(applied || sourceFilter) && <p className="marketing-directory-count">{count.toLocaleString("es-UY")} {count === 1 ? "resultado" : "resultados"}</p>}
      <div className="table-wrap"><table className="data-table marketing-directory-table"><thead><tr><th>Cliente</th><th>Mail</th><th>Celular</th><th>Origen</th><th>Suscripción</th><th>Cuenta</th><th>Alta</th></tr></thead><tbody>
        {contacts.map((contact) => <tr key={contact.id}><td className="marketing-directory-name"><button type="button" className="text-button" aria-label={`Ver ficha de ${contact.name || contact.email || "contacto"}`} onClick={() => setSelectedContact(contact)}>{contact.name || contact.email || "Contacto sin nombre"}</button></td><td>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : "—"}</td><td>{contact.phone ? <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>{contact.phone}</a> : "—"}</td><td><div className={`badge ${originBadgeClass(contact.source)}`}>{sourceName(contact.source)}</div></td><td><span className={`marketing-status marketing-status-${contact.subscription_status === "active" ? "active" : contact.subscription_status === "pending" ? "pending" : "neutral"}`}>{contact.subscription_status === "active" ? "Activa" : contact.subscription_status === "pending" ? "Pendiente" : contact.subscription_status === "none" ? "Sin suscripción" : "Baja"}</span></td><td>{contact.has_account ? "Registrada" : "—"}</td><td>{date(contact.created_at)}</td></tr>)}
      </tbody></table></div>
      {!contacts.length && <p className="marketing-directory-empty">No hay contactos con este filtro.</p>}
      <div className="marketing-directory-pagination"><button className="secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Página {page + 1} de {Math.max(1, Math.ceil(count / 50))}</span><button className="secondary" disabled={(page + 1) * 50 >= count} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div>
    </>}
    </section>
    {selectedCustomer && <CustomerDetailModal customer={selectedCustomer} s={s} go={go} commerce={commerce} onClose={() => setSelectedContact(null)} />}
  </div>;
}

function Subscription({ notify }: { notify: (message: string) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savedEnabled, setSavedEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void callMarketing<{ settings: Settings }>("settings").then((result) => { setSettings(result.settings); setSavedEnabled(result.settings.enabled); }).catch((reason) => setError(reason.message)); }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true); setError("");
    try {
      await callMarketing("saveSettings", { enabled: settings.enabled, headline: settings.headline, description: settings.description, discountCode: settings.discount_code, imageUrl: settings.image_url });
      setSavedEnabled(settings.enabled);
      notify("Suscripción guardada.");
    } catch (reason) { setError((reason as Error).message); }
    setSaving(false);
  };
  if (!settings) return <div role="status">{error || "Cargando suscripción…"}</div>;
  return <div className="marketing-subscription-page">
    <div className="marketing-subscription-layout">
      <section className="marketing-panel marketing-form marketing-subscription-editor">
        <form onSubmit={save}>
          <h2>Contenido</h2>
          <label>Título<input required maxLength={120} value={settings.headline} onChange={(event) => setSettings({ ...settings, headline: event.target.value })} /></label>
          <label>Descripción<textarea required maxLength={300} rows={3} value={settings.description} onChange={(event) => setSettings({ ...settings, description: event.target.value })} /></label>
          <h2>Beneficio</h2>
          <label>Código del 10%<input required maxLength={32} value={settings.discount_code} onChange={(event) => setSettings({ ...settings, discount_code: event.target.value.toUpperCase() })} /></label>
          <label className="marketing-subscription-switch"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} />Mostrar suscripción en la web<strong className={`marketing-subscription-visibility${savedEnabled ? " is-active" : ""}`}>{savedEnabled ? "Visible ahora" : "Oculto ahora"}</strong>{savedEnabled !== settings.enabled && <em>Sin guardar</em>}</label>
          {error && <div className="error" role="alert">{error}</div>}
          <div className="marketing-subscription-actions"><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></div>
        </form>
      </section>
      <aside className="marketing-subscription-preview"><div className="marketing-subscription-preview-heading"><h2>Vista previa</h2></div><div className="marketing-subscription-card">
        {settings.image_url && <img src={settings.image_url} alt="Vista previa de la imagen" />}
        <h3>{settings.headline || "Tu título aparecerá aquí"}</h3><div className="marketing-subscription-preview-description">{settings.description || "Tu descripción aparecerá aquí."}</div>
        <div className="marketing-subscription-preview-field">Nombre</div><div className="marketing-subscription-preview-field">Correo electrónico</div><div className="marketing-subscription-preview-button">Quiero mi 10%</div>
      </div></aside>
    </div>
  </div>;
}

function Campaigns({ notify }: { notify: (message: string) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [id, setId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [dirty, setDirty] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<Campaign | null>(null);
  const load = useCallback(async () => { const result = await callMarketing<{ campaigns: Campaign[] }>("campaigns"); setCampaigns(result.campaigns); }, []);
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, [load]);
  const reset = () => { setViewing(null); setId(""); setSubject(""); setMessage(""); setTargetUrl(""); setImageUrl(""); setFile(null); setDirty(false); setError(""); };
  const edit = (campaign: Campaign) => { setViewing(null); setId(campaign.id); setSubject(campaign.subject); setMessage(campaign.body); setTargetUrl(campaign.target_url || ""); setImageUrl(campaign.image_url || ""); setFile(null); setDirty(false); setError(""); };
  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(true); setError("");
    try {
      let uploaded = imageUrl;
      if (file) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error("La foto debe ser JPG, PNG o WebP de hasta 8 MB.");
        const path = `${crypto.randomUUID()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`;
        const result = await commerceSource!.storage.from("marketing-campaigns").upload(path, file, { contentType: file.type, upsert: false });
        if (result.error) throw result.error;
        uploaded = commerceSource!.storage.from("marketing-campaigns").getPublicUrl(path).data.publicUrl;
      }
      const result = await callMarketing<{ id: string }>("saveCampaign", { id: id || undefined, subject, message, imageUrl: uploaded, targetUrl });
      setId(result.id); setImageUrl(uploaded); setFile(null); setDirty(false); await load(); notify("Borrador guardado.");
    } catch (reason) { setError((reason as Error).message); }
    setBusy(false);
  };
  const send = async (action: "testCampaign" | "sendCampaign") => {
    if (!id) { setError("Guardá el borrador antes de enviar."); return; }
    if (dirty) { setError("Guardá los cambios antes de enviar."); return; }
    if (action === "sendCampaign" && !window.confirm("¿Enviar esta campaña a todos los suscriptores activos?")) return;
    setBusy(true); setError("");
    try {
      if (action === "sendCampaign") {
        let processed = 0;
        while (true) {
          const result = await callMarketing<{ processed: number; remaining: number; done: boolean }>("syncContacts");
          processed += result.processed;
          setSyncProgress(`Preparando destinatarios: ${processed} de ${processed + result.remaining}`);
          if (result.done) break;
        }
      }
      await callMarketing(action, { id, testEmail }); await load(); notify(action === "testCampaign" ? "Correo de prueba enviado." : "Campaña enviada."); if (action === "sendCampaign") reset();
    }
    catch (reason) { setError((reason as Error).message); }
    setSyncProgress(null);
    setBusy(false);
  };
  const sent = campaigns.filter((campaign) => campaign.status === "sent");
  const others = campaigns.filter((campaign) => campaign.status !== "sent");
  const campaignRow = (campaign: Campaign) => <button key={campaign.id} className={`marketing-campaign-row${viewing?.id === campaign.id ? " is-selected" : ""}`} onClick={() => campaign.status === "draft" ? edit(campaign) : (reset(), setViewing(campaign))}><strong>{campaign.subject}</strong><span>{campaign.status === "draft" ? "Borrador" : campaign.status === "sent" ? "Enviada" : "En proceso"} · {date(campaign.sent_at || campaign.created_at)}</span></button>;
  return <div className="marketing-layout">
    {viewing ? <section className="marketing-panel marketing-sent-view"><div className="marketing-inline"><h2>Campaña enviada</h2><button className="secondary" type="button" onClick={reset}>Nueva campaña</button></div>
      <p className="marketing-hint">Enviada el {date(viewing.sent_at || viewing.created_at)}</p>
      <h3>{viewing.subject}</h3>
      {viewing.image_url && (viewing.target_url ? <a href={viewing.target_url} target="_blank" rel="noreferrer"><img className="marketing-preview-image" src={viewing.image_url} alt="Imagen de la campaña" /></a> : <img className="marketing-preview-image" src={viewing.image_url} alt="Imagen de la campaña" />)}
      <div className="marketing-sent-body">{viewing.body}</div>
      {viewing.target_url ? <p className="marketing-hint">Enlace de la promoción: <a href={viewing.target_url} target="_blank" rel="noreferrer">{viewing.target_url}</a></p> : <p className="marketing-hint">Esta campaña no tenía enlace.</p>}
    </section> : <section className="marketing-panel marketing-form"><div className="marketing-inline"><h2>{id ? "Editar campaña" : "Nueva campaña"}</h2>{id && <button className="secondary" type="button" onClick={reset}>Nueva</button>}</div>
      <form onSubmit={(event) => void save(event)}>
        <label><span>Asunto</span><input required maxLength={160} value={subject} onChange={(event) => { setSubject(event.target.value); setDirty(true); }} /></label>
        <label><span>Mensaje</span><textarea required rows={8} maxLength={10000} value={message} onChange={(event) => { setMessage(event.target.value); setDirty(true); }} /></label>
        <label><span>Foto</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFile(event.target.files?.[0] || null); setDirty(true); }} /></label>
        {imageUrl && <img className="marketing-preview-image" src={imageUrl} alt="Vista previa de la campaña" />}
        <label><span>Enlace de la promoción</span><input type="url" placeholder="https://…" value={targetUrl} onChange={(event) => { setTargetUrl(event.target.value); setDirty(true); }} /><small className="marketing-hint">Al hacer clic en la foto o en el mensaje del correo se abre este enlace.</small></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Procesando…" : "Guardar borrador"}</button>
      </form>
      {id && <div className="marketing-send"><label><span>Correo de prueba</span><input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} /></label><div className="marketing-inline"><button className="secondary" disabled={busy || !testEmail} onClick={() => void send("testCampaign")}>Enviar prueba</button><button className="primary" disabled={busy} onClick={() => void send("sendCampaign")}>Enviar a suscriptores</button></div></div>}
      {syncProgress && <p role="status">{syncProgress}</p>}
    </section>}
    <section className="marketing-panel"><h2>Campañas enviadas ({sent.length})</h2>{sent.map(campaignRow)}{!sent.length && <p>Todavía no enviaste ninguna campaña.</p>}
      {others.length > 0 && <><h2 className="marketing-subtitle">Borradores y en proceso</h2>{others.map(campaignRow)}</>}</section>
  </div>;
}

type AnalyticsRow = { label: string; value?: string; pageviews: number; visitors: number };
type AnalyticsData = { site: { id: string; name: string }; sites: { id: string; name: string }[]; days: number; timeline: { timestamp: string; pageviews: number; visitors: number }[]; countries: AnalyticsRow[]; devices: AnalyticsRow[]; referrers: AnalyticsRow[]; pages: AnalyticsRow[]; products: AnalyticsRow[] };
type Dimension = "country" | "deviceType" | "referrerHostname" | "route" | "product";
type Group = { key: string; label: string; icon: ReactNode | null; values: string[]; pageviews: number; visitors: number; filterable: boolean };
type ActiveFilter = { label: string; icon: ReactNode | null; values: string[] };
const analyticsPreviewRows = 7;
const rangeOptions = [[1, "Hoy"], [7, "7 días"], [30, "30 días"], [90, "90 días"]] as const;
const dimensionTitles: Record<Dimension, string> = { route: "Página", product: "Producto", referrerHostname: "Fuente", country: "País", deviceType: "Dispositivo" };

type Naming = { label: string; icon: ReactNode | null };
const emoji = (value: string) => <span className="analytics-emoji" aria-hidden="true">{value}</span>;
const globe = emoji("🌐");
function Favicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? globe : <img className="analytics-favicon" src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`} alt="" width="20" height="20" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
const site = (domain: string) => <Favicon domain={domain} />;
const referrerRules: [RegExp, Naming][] = [
  [/(^|\.)instagram\.com$/, { label: "Instagram", icon: site("instagram.com") }],
  [/(^|\.)(facebook|fb)\.com$|^fb\.me$/, { label: "Facebook", icon: site("facebook.com") }],
  [/^com\.google\.android\.gm$/, { label: "Gmail", icon: site("mail.google.com") }],
  [/(^|\.)google\.[a-z.]+$/, { label: "Google", icon: site("google.com") }],
  [/(^|\.)(bing|yahoo|ecosia)\.com$/, { label: "Otros buscadores", icon: site("bing.com") }],
  [/(^|\.)duckduckgo\.com$/, { label: "DuckDuckGo", icon: site("duckduckgo.com") }],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, { label: "WhatsApp", icon: site("whatsapp.com") }],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, { label: "X (Twitter)", icon: site("x.com") }],
  [/(^|\.)tiktok\.com$/, { label: "TikTok", icon: site("tiktok.com") }],
  [/(^|\.)(youtube\.com|youtu\.be)$/, { label: "YouTube", icon: site("youtube.com") }],
  [/(^|\.)mercadopago\.[a-z.]+$|(^|\.)mercadolibre\.[a-z.]+$/, { label: "Mercado Pago / Libre", icon: site("mercadopago.com.uy") }],
  [/(^|\.)matearteuruguay\.com$/, { label: "MateArte (sitio)", icon: site("matearteuruguay.com") }],
  [/^matearte-visualizador\.vercel\.app$/, { label: "Personalizador", icon: site("matearte-visualizador.vercel.app") }],
  [/^matearte-gestion\.vercel\.app$/, { label: "Gestión (interno)", icon: site("matearte-gestion.vercel.app") }],
];
const routeRules: [RegExp, Naming][] = [
  [/^\/(\[locale\])?$/, { label: "Inicio", icon: emoji("🏠") }],
  [/^\/(\[locale\]\/)?(catalogo|catalog)$/, { label: "Catálogo", icon: emoji("📖") }],
  [/^\/(\[locale\]\/)?(producto|product)\/\[slug\]$/, { label: "Producto", icon: emoji("🧉") }],
  [/^\/(\[locale\]\/)?rural$/, { label: "Rural", icon: emoji("🌾") }],
  [/^\/(\[locale\]\/)?(personalizados|customized)$/, { label: "Personalizados", icon: emoji("✨") }],
  [/^\/(\[locale\]\/)?(perfil|profile)$/, { label: "Perfil", icon: emoji("👤") }],
  [/^\/(\[locale\]\/)?(pedidos|orders)\/\[id\]$/, { label: "Seguimiento de pedido", icon: emoji("📦") }],
  [/^\/(\[locale\]\/)?(carrito|cart)$/, { label: "Carrito", icon: emoji("🛒") }],
  [/^\/(\[locale\]\/)?(checkout|pagar)$/, { label: "Pago", icon: emoji("💳") }],
];
const segmentNames: Record<string, string> = {
  catalogo: "Catálogo", catalog: "Catálogo", custom: "Personalizados", customized: "Personalizados", personalizados: "Personalizados",
  producto: "Producto", produto: "Producto", product: "Producto", perfil: "Perfil", profile: "Perfil", editar: "Editar", edit: "Editar",
  pedidos: "Pedidos", orders: "Pedidos", carrito: "Carrito", cart: "Carrito", checkout: "Pago", pagar: "Pago", rural: "Rural",
};
const routeName = (raw: string) => {
  const segments = raw.replace(/^\/\[locale\]/, "").split("/").filter((segment) => segment && !/^\[.*\]$/.test(segment));
  if (!segments.length) return "Inicio";
  return segments.map((segment) => {
    const known = segmentNames[segment.toLowerCase()];
    if (known) return known;
    const text = decodeURIComponent(segment).replace(/[-_]+/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }).join(" › ");
};
const deviceNames: Record<string, Naming> = {
  desktop: { label: "Computadora", icon: emoji("🖥️") }, mobile: { label: "Celular", icon: emoji("📱") }, tablet: { label: "Tablet", icon: emoji("📲") },
};
const countryName = (code: string) => { try { return new Intl.DisplayNames(["es"], { type: "region" }).of(code.toUpperCase()) || code; } catch { return code; } };
const Flag = ({ code }: { code: string }) => {
  const Component = (flags as unknown as Record<string, ComponentType<{ className?: string }>>)[code.toUpperCase()];
  return Component ? <Component className="analytics-flag" /> : globe;
};

function nameFor(dimension: Dimension, raw: string): Naming & { filterable: boolean } {
  if (raw === "Others") return { label: "Otros", icon: globe, filterable: false };
  if (dimension === "country") return { label: /^[A-Za-z]{2}$/.test(raw) ? countryName(raw) : raw || "Desconocido", icon: /^[A-Za-z]{2}$/.test(raw) ? <Flag code={raw} /> : globe, filterable: Boolean(raw) };
  if (dimension === "deviceType") return { ...(deviceNames[raw.toLowerCase()] || { label: raw || "Otro", icon: globe }), filterable: Boolean(raw) };
  if (dimension === "product") return { label: raw || "—", icon: null, filterable: Boolean(raw) };
  if (dimension === "route") { const rule = routeRules.find(([pattern]) => pattern.test(raw)); return { label: rule?.[1].label || routeName(raw), icon: null, filterable: Boolean(raw) }; }
  if (!raw) return { label: "Directo", icon: emoji("🔗"), filterable: false };
  const rule = referrerRules.find(([pattern]) => pattern.test(raw));
  return { ...(rule?.[1] || { label: raw.replace(/^www\./, ""), icon: site(raw) }), filterable: true };
}
function groupRows(dimension: Dimension, rows: AnalyticsRow[]): Group[] {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const naming = nameFor(dimension, row.label);
    const raw = row.value ?? row.label;
    const existing = groups.get(naming.label);
    if (existing) { existing.visitors += row.visitors; existing.pageviews += row.pageviews; if (raw && !existing.values.includes(raw)) existing.values.push(raw); }
    else groups.set(naming.label, { key: naming.label, label: naming.label, icon: naming.icon, values: raw ? [raw] : [], pageviews: row.pageviews, visitors: row.visitors, filterable: naming.filterable });
  }
  return [...groups.values()].sort((x, y) => Number(x.key === "Otros") - Number(y.key === "Otros") || y.visitors - x.visitors);
}

function AnalyticsList({ title, dimension, rows, active, onToggle }: { title: string; dimension: Dimension; rows: AnalyticsRow[]; active?: ActiveFilter; onToggle: (dimension: Dimension, group: Group) => void }) {
  const groups = useMemo(() => groupRows(dimension, rows), [dimension, rows]);
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(1, ...groups.map((group) => group.visitors));
  const visible = expanded ? groups : groups.slice(0, analyticsPreviewRows);
  return <section className="marketing-panel analytics-list"><h2>{title}</h2>
    {groups.length ? visible.map((group) => {
      const selected = active?.label === group.label;
      return <button type="button" key={group.key} className={`analytics-row${selected ? " is-selected" : ""}`} disabled={!group.filterable} aria-pressed={group.filterable ? selected : undefined} title={group.filterable ? (selected ? "Quitar filtro" : "Filtrar todo el panel") : undefined} onClick={() => onToggle(dimension, group)}>
        <span className="analytics-row-head"><span className="analytics-row-label">{group.icon}<span>{group.label}</span></span><strong>{group.visitors.toLocaleString("es-UY")}</strong></span>
        <span className="analytics-bar"><i style={{ width: `${Math.max(2, (group.visitors / max) * 100)}%` }} /></span>
      </button>;
    }) : <p className="marketing-directory-empty">Sin datos en este período.</p>}
    {groups.length > analyticsPreviewRows && <button type="button" className="analytics-more" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "Ver menos" : `Ver más (${groups.length - analyticsPreviewRows})`}</button>}
  </section>;
}

function TrafficChart({ timeline, metric, days }: { timeline: AnalyticsData["timeline"]; metric: "visitors" | "pageviews"; days: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 1000, height = 260;
  const values = timeline.map((row) => row[metric]);
  const peak = Math.max(1, ...values);
  const top = Math.max(4, Math.ceil(peak / 4) * 4);
  const x = (index: number) => timeline.length < 2 ? width / 2 : (index / (timeline.length - 1)) * width;
  const y = (value: number) => height - (value / top) * height;
  const line = values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const area = values.length ? `${line} L${x(values.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z` : "";
  const format = (value: string, long = false) => new Intl.DateTimeFormat("es-UY", days === 1 ? { hour: "2-digit", minute: "2-digit", timeZone: "America/Montevideo" } : { day: "numeric", month: "short", ...(long ? { weekday: "short" as const } : {}), timeZone: "UTC" }).format(new Date(value));
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHover(timeline.length < 2 ? 0 : Math.round(ratio * (timeline.length - 1)));
  };
  const point = hover === null ? null : timeline[hover];
  return <div className="analytics-chart-wrap">
    <div className="analytics-yaxis" aria-hidden="true">{[4, 3, 2, 1, 0].map((step) => <span key={step}>{Math.round((top / 4) * step).toLocaleString("es-UY")}</span>)}</div>
    <div className="analytics-chart" role="img" aria-label="Evolución del tráfico" onPointerMove={move} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[0, 1, 2, 3, 4].map((step) => <line key={step} x1="0" x2={width} y1={(height / 4) * step} y2={(height / 4) * step} className="analytics-grid-line" />)}
        {area && <path d={area} className="analytics-area" />}
        {line && <path d={line} className="analytics-line" />}
      </svg>
      {hover !== null && point && <>
        <div className="analytics-cursor" style={{ left: `${(x(hover) / width) * 100}%` }} />
        <div className="analytics-dot" style={{ left: `${(x(hover) / width) * 100}%`, top: `${(y(point[metric]) / height) * 100}%` }} />
        <div className="analytics-tooltip" style={{ left: `${(x(hover) / width) * 100}%`, transform: `translateX(${hover > timeline.length * 0.7 ? "-105%" : "10%"})` }}>
          <small>{format(point.timestamp, true)}</small><strong>{point.visitors.toLocaleString("es-UY")} visitantes</strong><span>{point.pageviews.toLocaleString("es-UY")} visualizaciones</span>
        </div>
      </>}
    </div>
    {timeline.length > 0 && <div className="analytics-axis"><span>{format(timeline[0].timestamp)}</span><span>{format(timeline[timeline.length - 1].timestamp)}</span></div>}
  </div>;
}

function Analytics() {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<"visitors" | "pageviews">("visitors");
  const [filters, setFilters] = useState<Partial<Record<Dimension, ActiveFilter>>>({});
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const filterPayload = useMemo(() => Object.fromEntries(Object.entries(filters).map(([dimension, filter]) => [dimension === "product" ? "requestPath" : dimension, filter?.values])), [filters]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void callMarketing<AnalyticsData>("analytics", { site: "tienda", days, filters: filterPayload })
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days, filterPayload]);
  const toggle = (dimension: Dimension, group: Group) => {
    if (!group.filterable) return;
    setFilters((current) => {
      const next = { ...current };
      if (current[dimension]?.label === group.label) delete next[dimension]; else next[dimension] = { label: group.label, icon: group.icon, values: group.values };
      return next;
    });
  };
  const timeline = data?.timeline || [];
  const pageviews = timeline.reduce((total, row) => total + row.pageviews, 0);
  // Los dispositivos cubren a cada visitante una sola vez en todo el período; sumar días lo contaría de más.
  const visitors = (data?.devices || []).reduce((total, row) => total + row.visitors, 0);
  const activeFilters = Object.entries(filters) as [Dimension, ActiveFilter][];
  return <div className="marketing-analytics-page">
    <div className="analytics-toolbar">
      <div className="tabs analytics-range" role="group" aria-label="Período">{rangeOptions.map(([value, label]) => <button key={value} className={days === value ? "active" : ""} onClick={() => setDays(value)}>{label}</button>)}</div>
    </div>
    {activeFilters.length > 0 && <div className="analytics-filters" aria-label="Filtros activos">
      {activeFilters.map(([dimension, filter]) => <button type="button" key={dimension} className="analytics-chip" onClick={() => setFilters(({ [dimension]: _removed, ...rest }) => rest)} title="Quitar filtro"><small>{dimensionTitles[dimension]}</small>{filter.icon}<span>{filter.label}</span><b aria-hidden="true">×</b></button>)}
      <button type="button" className="analytics-clear" onClick={() => setFilters({})}>Quitar todos</button>
    </div>}
    {error && <p className="error" role="alert">{error}</p>}
    {loading && !data && !error && <p role="status">Cargando estadísticas…</p>}
    {data && <div className={loading ? "analytics-loading" : undefined}>
      <section className="marketing-panel analytics-overview">
        <div className="analytics-metrics" role="tablist" aria-label="Métrica del gráfico">
          <button type="button" role="tab" aria-selected={metric === "visitors"} onClick={() => setMetric("visitors")}><small>Visitantes</small><strong>{visitors.toLocaleString("es-UY")}</strong></button>
          <button type="button" role="tab" aria-selected={metric === "pageviews"} onClick={() => setMetric("pageviews")}><small>Visualizaciones</small><strong>{pageviews.toLocaleString("es-UY")}</strong></button>
          <div className="analytics-metric-static"><small>Páginas por visitante</small><strong>{visitors ? (pageviews / visitors).toLocaleString("es-UY", { maximumFractionDigits: 1 }) : "—"}</strong></div>
        </div>
        {timeline.length ? <TrafficChart timeline={timeline} metric={metric} days={days} /> : <p className="marketing-directory-empty">Sin visitas en este período.</p>}
      </section>
      <div className="analytics-grid">
        <AnalyticsList title="Páginas más vistas" dimension="route" rows={data.pages} active={filters.route} onToggle={toggle} />
        <AnalyticsList title="Productos más vistos" dimension="product" rows={data.products || []} active={filters.product} onToggle={toggle} />
        <AnalyticsList title="Fuentes de tráfico" dimension="referrerHostname" rows={data.referrers} active={filters.referrerHostname} onToggle={toggle} />
        <AnalyticsList title="Países" dimension="country" rows={data.countries} active={filters.country} onToggle={toggle} />
        <AnalyticsList title="Dispositivos" dimension="deviceType" rows={data.devices} active={filters.deviceType} onToggle={toggle} />
      </div>
      <p className="analytics-note">Datos de Vercel Web Analytics. Tocá una fila para filtrar todo el panel.</p>
    </div>}
  </div>;
}

export function MarketingSection({ page, notify, s, go, commerce }: { page: string; notify: (message: string) => void; s: State; go: (path: string) => void; commerce?: CommerceSnapshot | null }) {
  if (page === "contactos") return <Contacts s={s} go={go} commerce={commerce} />;
  if (page === "analytics") return <Analytics />;
  if (page === "suscripcion") return <Subscription notify={notify} />;
  return <Campaigns notify={notify} />;
}
