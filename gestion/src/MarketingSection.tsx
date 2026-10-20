import { useCallback, useEffect, useState, type FormEvent } from "react";
import { commerceSource } from "./commerceSource";
import { customerOriginClass, customerOriginLabel, customerOriginOptions, customerOriginValue } from "./customerChannel";

type Contact = { id: string; name: string | null; email: string | null; phone: string | null; source: string; created_at: string; has_account: boolean; subscription_status: string };
type ContactSummary = { total: number; origins: { source: string; contacts: number }[] };
type Campaign = { id: string; subject: string; body: string; image_url: string | null; target_url: string | null; status: string; created_at: string; sent_at: string | null };
type Settings = { enabled: boolean; headline: string; description: string; image_url: string | null; discount_code: string };

async function callMarketing<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!commerceSource) throw new Error("El comercio no está conectado.");
  const { data, error } = await commerceSource.functions.invoke("marketing-workspace", { body: { action, ...payload } });
  if (error || data?.error) throw new Error(data?.error || error?.message || "No se pudo completar la operación.");
  return data as T;
}

const date = (value: string | null) => value ? new Intl.DateTimeFormat("es-UY", { dateStyle: "medium" }).format(new Date(value)) : "—";
const sourceName = customerOriginLabel;
const originBadgeClass = customerOriginClass;

function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState<ContactSummary | null>(null);
  const [page, setPage] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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
        {contacts.map((contact) => <tr key={contact.id}><td className="marketing-directory-name">{contact.name || "—"}</td><td>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : "—"}</td><td>{contact.phone ? <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>{contact.phone}</a> : "—"}</td><td><div className={`badge ${originBadgeClass(contact.source)}`}>{sourceName(contact.source)}</div></td><td><span className={`marketing-status marketing-status-${contact.subscription_status === "active" ? "active" : contact.subscription_status === "pending" ? "pending" : "neutral"}`}>{contact.subscription_status === "active" ? "Activa" : contact.subscription_status === "pending" ? "Pendiente" : contact.subscription_status === "none" ? "Sin suscripción" : "Baja"}</span></td><td>{contact.has_account ? "Registrada" : "—"}</td><td>{date(contact.created_at)}</td></tr>)}
      </tbody></table></div>
      {!contacts.length && <p className="marketing-directory-empty">No hay contactos con este filtro.</p>}
      <div className="marketing-directory-pagination"><button className="secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Página {page + 1} de {Math.max(1, Math.ceil(count / 50))}</span><button className="secondary" disabled={(page + 1) * 50 >= count} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div>
    </>}
    </section>
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
  const load = useCallback(async () => { const result = await callMarketing<{ campaigns: Campaign[] }>("campaigns"); setCampaigns(result.campaigns); }, []);
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, [load]);
  const reset = () => { setId(""); setSubject(""); setMessage(""); setTargetUrl(""); setImageUrl(""); setFile(null); setDirty(false); setError(""); };
  const edit = (campaign: Campaign) => { setId(campaign.id); setSubject(campaign.subject); setMessage(campaign.body); setTargetUrl(campaign.target_url || ""); setImageUrl(campaign.image_url || ""); setFile(null); setDirty(false); setError(""); };
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
  return <div className="marketing-layout">
    <section className="marketing-panel marketing-form"><div className="marketing-inline"><h2>{id ? "Editar campaña" : "Nueva campaña"}</h2>{id && <button className="secondary" type="button" onClick={reset}>Nueva</button>}</div>
      <form onSubmit={(event) => void save(event)}>
        <label><span>Asunto</span><input required maxLength={160} value={subject} onChange={(event) => { setSubject(event.target.value); setDirty(true); }} /></label>
        <label><span>Mensaje</span><textarea required rows={8} maxLength={10000} value={message} onChange={(event) => { setMessage(event.target.value); setDirty(true); }} /></label>
        <label><span>Foto</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFile(event.target.files?.[0] || null); setDirty(true); }} /></label>
        {imageUrl && <img className="marketing-preview-image" src={imageUrl} alt="Vista previa de la campaña" />}
        <label><span>Enlace del botón</span><input type="url" placeholder="https://…" value={targetUrl} onChange={(event) => { setTargetUrl(event.target.value); setDirty(true); }} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Procesando…" : "Guardar borrador"}</button>
      </form>
      {id && <div className="marketing-send"><label><span>Correo de prueba</span><input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} /></label><div className="marketing-inline"><button className="secondary" disabled={busy || !testEmail} onClick={() => void send("testCampaign")}>Enviar prueba</button><button className="primary" disabled={busy} onClick={() => void send("sendCampaign")}>Enviar a suscriptores</button></div></div>}
      {syncProgress && <p role="status">{syncProgress}</p>}
    </section>
    <section className="marketing-panel"><h2>Campañas</h2>{campaigns.map((campaign) => <button key={campaign.id} className="marketing-campaign-row" onClick={() => campaign.status === "draft" && edit(campaign)}><strong>{campaign.subject}</strong><span>{campaign.status === "draft" ? "Borrador" : campaign.status === "sent" ? "Enviada" : "En proceso"} · {date(campaign.sent_at || campaign.created_at)}</span></button>)}{!campaigns.length && <p>Tu primera campaña aparecerá acá.</p>}</section>
  </div>;
}

export function MarketingSection({ page, notify }: { page: string; notify: (message: string) => void }) {
  if (page === "contactos") return <Contacts />;
  if (page === "suscripcion") return <Subscription notify={notify} />;
  return <Campaigns notify={notify} />;
}
