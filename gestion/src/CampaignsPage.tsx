import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { commerceSource } from "./commerceSource";
import { callMarketing } from "./marketingApi";
import { formatDate } from "./dateFormat";
import { marketingCampaignHtml, type MarketingCampaignMode } from "../../shared/marketingCampaignHtml";
import { describeSegment } from "../../shared/marketingSegments";
import type { SavedSegment } from "./SegmentsPage";

type AudienceMode = "all" | "selected";
type AudienceChoice = AudienceMode | "segment";
type Discount = { code: string; discount_type: "percentage" | "fixed"; value: number; valid_until: string };
type BatchInfo = { groupId: string; number: number; total: number; segmentName: string | null };
// Plan gratis de Resend: 100 correos por día entre campañas y correos de pedidos.
const DAILY_MAIL_LIMIT = 100;
const defaultBatchSize = 80;
type Campaign = {
  id: string; subject: string; headline: string | null; body: string; button_label: string | null;
  image_url: string | null; target_url: string | null;
  mode: MarketingCampaignMode; audience_mode: AudienceMode; selected_emails: string[];
  recipient_count: number | null; resend_broadcast_id: string | null;
  status: string; created_at: string; sent_at: string | null;
  batch_group_id: string | null; batch_number: number | null; batch_total: number | null; segment_name: string | null;
  discount_code: string | null; utm_campaign: string | null;
};
type AudienceContact = { email: string; name: string | null; subscription_status: string };
type HistoryCampaign = {
  id: string; broadcast_id: string; subject: string; sent_at: string; audience_mode: AudienceMode | "external";
  recipient_count: number | null; status: string; source: "gestion" | "resend";
  batch_number?: number | null; batch_total?: number | null; segment_name?: string | null;
};
type View = "message" | "image" | "sent";

const readableDate = (value: string | null) => formatDate(value);
const previewCss = '<style>html,body{max-width:100%!important;overflow-x:hidden!important}img,table{max-width:100%!important}*{box-sizing:border-box;overflow-wrap:anywhere}</style>';
const withPreviewCss = (html: string) => html.includes("</head>") ? html.replace("</head>", `${previewCss}</head>`) : `${previewCss}${html}`;

function PreviewFrame({ html, title }: { html: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(220);
  const measure = useCallback(() => {
    const document = frame.current?.contentDocument;
    if (document?.body) setHeight(Math.max(220, document.body.scrollHeight + 4));
  }, []);
  useEffect(() => {
    const document = frame.current?.contentDocument;
    if (!document?.body) return;
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [html, measure]);
  return <iframe ref={frame} title={title} sandbox="allow-same-origin" scrolling="no" style={{ height }} srcDoc={withPreviewCss(html)} onLoad={measure} />;
}

export function CampaignsPage({ notify }: { notify: (message: string) => void }) {
  const [view, setView] = useState<View>("message");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [history, setHistory] = useState<HistoryCampaign[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [selectedHistory, setSelectedHistory] = useState<HistoryCampaign | null>(null);
  const [sentHtml, setSentHtml] = useState("");
  const [id, setId] = useState("");
  const [subject, setSubject] = useState("");
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");
  const [audienceChoice, setAudienceChoice] = useState<AudienceChoice>("all");
  const [segments, setSegments] = useState<SavedSegment[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [segmentCount, setSegmentCount] = useState<number | null>(null);
  const [batchSize, setBatchSize] = useState(defaultBatchSize);
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [rebatchCount, setRebatchCount] = useState(2);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [discountCode, setDiscountCode] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [sentToday, setSentToday] = useState<number | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [audienceQuery, setAudienceQuery] = useState("");
  const [audiencePage, setAudiencePage] = useState(0);
  const [audience, setAudience] = useState<AudienceContact[]>([]);
  const [audienceCount, setAudienceCount] = useState(0);
  const [audienceTotal, setAudienceTotal] = useState<number | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const result = await callMarketing<{ campaigns: Campaign[] }>("campaigns");
    setCampaigns(result.campaigns);
    return result.campaigns;
  }, []);
  const loadQuota = useCallback(async () => {
    try { setSentToday((await callMarketing<{ sentToday: number }>("campaignQuota")).sentToday ?? null); } catch { setSentToday(null); }
  }, []);
  useEffect(() => {
    void callMarketing<{ segments: SavedSegment[] }>("segments").then((result) => setSegments(Array.isArray(result.segments) ? result.segments : [])).catch(() => setSegments([]));
    void callMarketing<{ discounts: Discount[] }>("campaignDiscounts").then((result) => setDiscounts(Array.isArray(result.discounts) ? result.discounts : [])).catch(() => setDiscounts([]));
    void loadQuota();
  }, [loadQuota]);
  const segment = segments.find((entry) => entry.id === segmentId);
  useEffect(() => {
    if (audienceChoice !== "segment" || !segment) { setSegmentCount(null); return; }
    let active = true;
    void callMarketing<{ count: number }>("segmentPreview", { filters: segment.filters })
      .then((result) => { if (active) setSegmentCount(result.count ?? null); })
      .catch(() => { if (active) setSegmentCount(null); });
    return () => { active = false; };
  }, [audienceChoice, segment]);
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true); setHistoryError("");
    try {
      const result = await callMarketing<{ campaigns: HistoryCampaign[]; count: number }>("sentCampaigns");
      setHistory(result.campaigns); setHistoryCount(result.count);
    } catch (reason) { setHistoryError((reason as Error).message); }
    setHistoryLoading(false);
  }, []);
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, [load]);
  useEffect(() => { if (view === "sent") void loadHistory(); }, [view, loadHistory]);
  useEffect(() => {
    let active = true;
    void callMarketing<{ contacts: AudienceContact[]; count: number; total: number }>("campaignAudience", { query: audienceQuery, page: audiencePage })
      .then((result) => { if (active) { setAudience(result.contacts); setAudienceCount(result.count); setAudienceTotal(result.total); } })
      .catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [audienceQuery, audiencePage]);
  useEffect(() => {
    if (!file) { setFilePreview(""); return; }
    const url = URL.createObjectURL(file); setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const mode: MarketingCampaignMode = view === "image" ? "image" : "message";
  const previewHtml = useMemo(() => marketingCampaignHtml({
    mode, subject: subject || "Asunto de la campaña", headline: headline || "Título de la campaña",
    body: message || "Tu descripción aparecerá aquí.", button_label: buttonLabel || "Ver más",
    image_url: filePreview || imageUrl || null, target_url: targetUrl || null,
    discount_code: discountCode || null, utm_campaign: utmCampaign || null,
  }), [mode, subject, headline, message, buttonLabel, filePreview, imageUrl, targetUrl, discountCode, utmCampaign]);
  const drafts = campaigns.filter((campaign) => campaign.status === "draft");
  const groupDrafts = batch ? drafts.filter((entry) => entry.batch_group_id === batch.groupId) : [];
  const pendingBatches = groupDrafts.length;
  const pendingPeople = groupDrafts.reduce((total, entry) => total + (entry.selected_emails?.length || 0), 0);
  useEffect(() => { if (pendingBatches) setRebatchCount(pendingBatches); }, [batch?.groupId, pendingBatches]);

  const reset = (nextView: View = "message") => {
    setId(""); setSubject(""); setHeadline(""); setMessage(""); setButtonLabel(""); setTargetUrl(""); setImageUrl(""); setFile(null);
    setAudienceChoice("all"); setSegmentId(""); setBatch(null); setDiscountCode(""); setUtmCampaign("");
    setSelectedEmails([]); setDirty(false); setError(""); setProgress(""); setView(nextView);
  };
  const edit = (campaign: Campaign) => {
    setId(campaign.id); setSubject(campaign.subject); setHeadline(campaign.headline || campaign.subject);
    setMessage(campaign.body); setButtonLabel(campaign.button_label || ""); setTargetUrl(campaign.target_url || "");
    setImageUrl(campaign.image_url || ""); setFile(null);
    setAudienceChoice(campaign.audience_mode === "selected" && !campaign.batch_group_id ? "selected" : "all");
    setBatch(campaign.batch_group_id ? { groupId: campaign.batch_group_id, number: campaign.batch_number || 1, total: campaign.batch_total || 1, segmentName: campaign.segment_name } : null);
    setDiscountCode(campaign.discount_code || ""); setUtmCampaign(campaign.utm_campaign || "");
    setSelectedEmails(campaign.selected_emails || []); setDirty(false); setError(""); setProgress("");
    setView(campaign.mode === "image" ? "image" : "message");
  };
  const mark = () => setDirty(true);
  const save = async (event?: FormEvent) => {
    event?.preventDefault(); setBusy(true); setError("");
    try {
      let uploaded = imageUrl;
      if (file) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error("La imagen debe ser JPG, PNG o WebP de hasta 8 MB.");
        const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const path = `${crypto.randomUUID()}.${extension}`;
        const result = await commerceSource!.storage.from("marketing-campaigns").upload(path, file, { contentType: file.type, upsert: false });
        if (result.error) throw result.error;
        uploaded = commerceSource!.storage.from("marketing-campaigns").getPublicUrl(path).data.publicUrl;
      }
      const result = await callMarketing<{ id: string }>("saveCampaign", {
        id: id || undefined, subject, headline, message, buttonLabel, imageUrl: uploaded, targetUrl, mode,
        audienceMode: audienceChoice === "selected" ? "selected" : "all", selectedEmails, discountCode,
      });
      setId(result.id); setImageUrl(uploaded); setFile(null); setDirty(false);
      const saved = (await load()).find((entry) => entry.id === result.id);
      if (saved?.utm_campaign) setUtmCampaign(saved.utm_campaign);
      notify("Borrador guardado.");
    } catch (reason) { setError((reason as Error).message); }
    setBusy(false);
  };
  const sendTest = async () => {
    if (!id || dirty) { setError("Guardá el borrador antes de enviar una prueba."); return; }
    setBusy(true); setError("");
    try { await callMarketing("testCampaign", { id, testEmail }); notify("Correo de prueba enviado."); }
    catch (reason) { setError((reason as Error).message); }
    setBusy(false);
  };
  const send = async () => {
    if (!id || dirty) { setError("Guardá el borrador antes de enviar."); return; }
    setBusy(true); setError("");
    try {
      let ready = 0, excluded = 0;
      for (;;) {
        const result = await callMarketing<{ processed: number; remaining: number; ready: number; excluded: number; done: boolean }>("prepareCampaign", { id });
        ready = result.ready; excluded = result.excluded;
        setProgress(`Preparando destinatarios: ${result.processed} de ${result.processed + result.remaining}`);
        if (result.done) break;
      }
      setProgress("");
      if (!ready) throw new Error("No hay destinatarios disponibles después de revisar bajas y bloqueos.");
      const overLimit = sentToday !== null && sentToday + ready > DAILY_MAIL_LIMIT;
      if (!window.confirm(`¿Enviar “${subject}” a ${ready} ${ready === 1 ? "persona" : "personas"}?${excluded ? ` Se excluyeron ${excluded} correos.` : ""}${overLimit ? ` Ojo: hoy ya salieron ${sentToday} correos de campañas y el plan gratis de Resend permite ${DAILY_MAIL_LIMIT} por día entre todos los correos. Los que sobren pueden ser rechazados.` : ""}`)) return;
      const result = await callMarketing<{ status: string }>("sendCampaign", { id });
      await load();
      await loadQuota();
      notify(result.status === "sent" ? "Campaña enviada." : "Campaña registrada en Resend. El envío está en proceso.");
      reset();
    } catch (reason) { setError((reason as Error).message); }
    finally { setProgress(""); setBusy(false); }
  };
  const splitBatches = async () => {
    if (!id || dirty) { setError("Guardá el borrador antes de dividirlo en tandas."); return; }
    if (audienceChoice === "segment" && !segment) { setError("Elegí un segmento."); return; }
    setBusy(true); setError("");
    try {
      const result = await callMarketing<{ total: number; batches: number[] }>("createBatches", { id, batchSize, ...(audienceChoice === "segment" ? { segmentId } : {}) });
      const first = (await load()).find((entry) => entry.id === id);
      if (first) edit(first);
      notify(`Se ${result.batches.length === 1 ? "creó 1 tanda" : `crearon ${result.batches.length} tandas`} para ${result.total} personas.`);
    } catch (reason) { setError((reason as Error).message); }
    setBusy(false);
  };
  const rebatch = async () => {
    if (!id || dirty) { setError("Guardá el borrador antes de reorganizar las tandas."); return; }
    setBusy(true); setError("");
    try {
      const result = await callMarketing<{ batches: number[] }>("rebatchCampaigns", { id, batches: rebatchCount });
      const list = await load();
      const current = list.find((entry) => entry.id === id) || list.filter((entry) => entry.batch_group_id === batch?.groupId && entry.status === "draft").sort((a, b) => (a.batch_number || 0) - (b.batch_number || 0))[0];
      if (current) edit(current); else reset(view);
      notify(`Quedaron ${result.batches.length} ${result.batches.length === 1 ? "tanda pendiente" : "tandas pendientes"}: ${result.batches.join(", ")} personas.`);
    } catch (reason) { setError((reason as Error).message); }
    setBusy(false);
  };
  const removeDraft = async (scope: "one" | "group") => {
    if (!id || !window.confirm(scope === "group" ? "¿Eliminar todas las tandas pendientes de esta campaña?" : "¿Eliminar este borrador?")) return;
    setBusy(true); setError("");
    try {
      await callMarketing("deleteCampaignDraft", { id, scope });
      await load(); reset(view); notify(scope === "group" ? "Tandas eliminadas." : "Borrador eliminado.");
    } catch (reason) { setError((reason as Error).message); }
    setBusy(false);
  };
  const selectHistory = async (item: HistoryCampaign) => {
    setSelectedHistory(item); setSentHtml(""); setHistoryError("");
    if (item.broadcast_id) {
      try {
        const result = await callMarketing<{ subject: string; html: string }>("campaignDetail", { broadcastId: item.broadcast_id });
        setSentHtml(result.html);
        if (result.subject) {
          setSelectedHistory({ ...item, subject: result.subject });
          setHistory((current) => current.map((entry) => entry.id === item.id ? { ...entry, subject: result.subject } : entry));
        }
      } catch (reason) { setHistoryError((reason as Error).message); }
    } else {
      const own = campaigns.find((campaign) => campaign.id === item.id);
      if (own) setSentHtml(marketingCampaignHtml(own));
    }
  };
  const toggleEmail = (email: string) => { setSelectedEmails((current) => current.includes(email) ? current.filter((entry) => entry !== email) : [...current, email]); mark(); };

  return <div className="marketing-campaigns-page">
    <div className="marketing-campaign-tabs" role="tablist" aria-label="Campañas de email">
      <button role="tab" aria-selected={view === "message"} className={view === "message" ? "active" : ""} onClick={() => { setView("message"); mark(); }}>Mensaje</button>
      <button role="tab" aria-selected={view === "image"} className={view === "image" ? "active" : ""} onClick={() => { setView("image"); mark(); }}>Solo imagen</button>
      <button role="tab" aria-selected={view === "sent"} className={view === "sent" ? "active" : ""} onClick={() => setView("sent")}>Campañas enviadas</button>
    </div>
    {view === "sent" ? <section className="marketing-campaign-history" role="tabpanel">
      <div className="marketing-campaign-heading"><div><h2>Campañas enviadas ({historyCount})</h2><p>Correos enviados desde Gestión y campañas anteriores de Resend.</p></div><button className="secondary" onClick={() => void loadHistory()} disabled={historyLoading}>Actualizar</button></div>
      {historyError && <p className="error" role="alert">{historyError}</p>}
      {historyLoading && <p role="status">Cargando campañas…</p>}
      {!historyLoading && !history.length && <p>Todavía no hay campañas enviadas.</p>}
      <div className="marketing-campaign-history-layout">
        <div className="marketing-campaign-history-list">
          {history.map((item) => <button key={`${item.source}:${item.id}`} className={`marketing-campaign-history-row${selectedHistory?.id === item.id ? " active" : ""}`} onClick={() => void selectHistory(item)}>
            <strong>{item.subject}{item.batch_number ? ` · Tanda ${item.batch_number} de ${item.batch_total}` : ""}</strong><span>{readableDate(item.sent_at)} · {item.segment_name ? `Segmento ${item.segment_name}` : item.batch_number ? "Todas las personas" : item.audience_mode === "selected" ? "Personas elegidas" : item.audience_mode === "all" ? "Todos" : "Resend"}</span>
            <span>{item.status === "queued" || item.status === "sending" ? "En proceso" : item.recipient_count === null ? "Enviados: sin dato" : `Enviados: ${item.recipient_count}`}</span>
          </button>)}
        </div>
        {selectedHistory && <div className="marketing-campaign-history-detail"><h3>{selectedHistory.subject}</h3><p>{readableDate(selectedHistory.sent_at)} · {selectedHistory.recipient_count === null ? "Sin dato de destinatarios" : `${selectedHistory.recipient_count} enviados`}</p>
          {sentHtml ? <PreviewFrame title={`Correo enviado: ${selectedHistory.subject}`} html={sentHtml} /> : <p>Cargando correo…</p>}
        </div>}
      </div>
    </section> : <div className="marketing-campaign-compose" role="tabpanel">
      <section className="marketing-panel marketing-campaign-editor"><div className="marketing-campaign-heading"><h2>{id ? "Editar campaña" : view === "image" ? "Nueva campaña con imagen" : "Nueva campaña"}</h2><button className="secondary" type="button" onClick={() => reset(view)}>Nueva</button></div>
        {drafts.length > 0 && <label className="marketing-campaign-draft-picker">Abrir borrador<select value={id} onChange={(event) => { const campaign = drafts.find((entry) => entry.id === event.target.value); if (campaign) edit(campaign); else reset(view); }}><option value="">Nueva campaña</option>{drafts.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.batch_number ? `[Tanda ${campaign.batch_number}/${campaign.batch_total}] ` : ""}{campaign.subject}</option>)}</select></label>}
        <form onSubmit={(event) => void save(event)}>
          <label>Asunto<input required maxLength={160} value={subject} onChange={(event) => { setSubject(event.target.value); mark(); }} /></label>
          {view === "message" && <><label>Título<input required maxLength={180} value={headline} onChange={(event) => { setHeadline(event.target.value); mark(); }} placeholder="Título dentro del correo" /></label><label>Descripción<textarea required rows={11} maxLength={10000} value={message} onChange={(event) => { setMessage(event.target.value); mark(); }} placeholder="Escribí la descripción en texto plano…" /></label></>}
          <label>{view === "image" ? "Imagen" : "Imagen opcional"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFile(event.target.files?.[0] || null); mark(); }} />{imageUrl && !file && <small>Imagen guardada en el borrador.</small>}</label>
          <label>Enlace opcional<input type="url" placeholder="https://…" value={targetUrl} onChange={(event) => { setTargetUrl(event.target.value); mark(); }} /></label>
          {view === "message" && targetUrl && <label>Texto del botón<input maxLength={60} value={buttonLabel} onChange={(event) => { setButtonLabel(event.target.value); mark(); }} placeholder="Ver más" /><small>El botón aparece cuando agregás un enlace.</small></label>}
          {targetUrl && utmCampaign && <small>Los enlaces a matearteuruguay.com llevan el seguimiento utm_campaign={utmCampaign}.</small>}
          {view === "message" && <label>Descuento opcional<select value={discountCode} onChange={(event) => { setDiscountCode(event.target.value); mark(); }}><option value="">Sin descuento</option>{discounts.map((discount) => <option key={discount.code} value={discount.code}>{discount.code} · {discount.discount_type === "percentage" ? `${discount.value}%` : `${discount.value} UYU`} · hasta {readableDate(discount.valid_until)}</option>)}</select>{discountCode && <small>El código aparece destacado en el correo.</small>}</label>}
          {batch ? <div className="marketing-campaign-batch" role="note">
            <p><strong>Tanda {batch.number} de {batch.total}</strong> · {batch.segmentName ? `Segmento ${batch.segmentName}` : "Todas las personas"} · {selectedEmails.length} {selectedEmails.length === 1 ? "persona" : "personas"}</p>
            <p>El texto, la imagen, el enlace y el descuento se comparten con las demás tandas pendientes. Enviá una tanda por día para no pasar el límite de Resend.</p>
            <label>Cantidad de tandas pendientes<input type="number" min={1} max={Math.max(1, Math.min(60, pendingPeople))} inputMode="numeric" value={rebatchCount} onChange={(event) => setRebatchCount(Math.min(60, Math.max(1, Math.floor(Number(event.target.value)) || 1)))} /></label>
            <p>{pendingPeople} {pendingPeople === 1 ? "persona" : "personas"} → {rebatchCount} {rebatchCount === 1 ? "tanda" : "tandas"} de {Math.ceil(pendingPeople / rebatchCount)} como máximo. Se reparten parejo y salen primero quienes compraron hace menos tiempo.</p>
            <div className="marketing-campaign-actions"><button type="button" className="secondary" disabled={busy || dirty || !pendingBatches || rebatchCount === pendingBatches} onClick={() => void rebatch()}>Reorganizar tandas</button><button type="button" className="secondary" disabled={busy} onClick={() => void removeDraft("group")}>Eliminar tandas pendientes</button></div>
            {dirty && <small>Guardá el borrador antes de reorganizar las tandas.</small>}
          </div> : <>
            <fieldset className="marketing-campaign-audience"><legend>Enviar a</legend><label><input type="radio" checked={audienceChoice === "all"} onChange={() => { setAudienceChoice("all"); mark(); }} />Todos ({audienceTotal === null ? "…" : audienceTotal})</label><label><input type="radio" checked={audienceChoice === "segment"} onChange={() => { setAudienceChoice("segment"); mark(); }} />Un segmento ({segments.length})</label><label><input type="radio" checked={audienceChoice === "selected"} onChange={() => { setAudienceChoice("selected"); mark(); }} />Elegir personas ({selectedEmails.length})</label></fieldset>
            {audienceChoice === "segment" && <div className="marketing-campaign-plan">
              <label>Segmento<select aria-label="Segmento" value={segmentId} onChange={(event) => setSegmentId(event.target.value)}><option value="">Elegí un segmento</option>{segments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
              {segment && <p>{describeSegment(segment.filters).join(" · ") || "Todas las personas"}{segmentCount !== null && ` · ${segmentCount} ${segmentCount === 1 ? "persona" : "personas"}`}</p>}
              {!segments.length && <p>Todavía no hay segmentos. Creálos en Marketing › Segmentos.</p>}
            </div>}
            {(audienceChoice === "segment" || (audienceChoice === "all" && (audienceTotal ?? 0) > batchSize)) && <div className="marketing-campaign-plan">
              <label>Correos por tanda<input type="number" min={1} max={500} inputMode="numeric" value={batchSize} onChange={(event) => setBatchSize(Math.min(500, Math.max(1, Math.floor(Number(event.target.value)) || 1)))} /></label>
              {(() => { const people = audienceChoice === "segment" ? segmentCount : audienceTotal; return people === null ? null : <p>{people} {people === 1 ? "persona" : "personas"} → {Math.ceil(people / batchSize)} {Math.ceil(people / batchSize) === 1 ? "tanda" : "tandas"}. Salen primero quienes compraron hace menos tiempo. El plan gratis de Resend permite {DAILY_MAIL_LIMIT} correos por día entre campañas y pedidos.</p>; })()}
              <div className="marketing-campaign-actions"><button type="button" className="secondary" disabled={busy || !id || dirty || (audienceChoice === "segment" && !segment)} onClick={() => void splitBatches()}>Dividir en tandas</button>{(!id || dirty) && <small>Guardá el borrador primero.</small>}</div>
            </div>}
          </>}
          {!batch && audienceChoice === "selected" && <div className="marketing-campaign-picker"><input type="search" aria-label="Buscar destinatarios" placeholder="Buscar por nombre o email…" value={audienceQuery} onChange={(event) => { setAudienceQuery(event.target.value); setAudiencePage(0); }} />
            {selectedEmails.length > 0 && <div className="marketing-campaign-selected">{selectedEmails.map((email) => <button key={email} type="button" onClick={() => toggleEmail(email)} aria-label={`Quitar ${email}`}>{email} ×</button>)}</div>}
            <div className="marketing-campaign-contacts">{audience.map((contact) => <label key={contact.email}><input type="checkbox" checked={selectedEmails.includes(contact.email)} onChange={() => toggleEmail(contact.email)} /><span><strong>{contact.name || contact.email}</strong><small>{contact.email}</small></span></label>)}{!audience.length && <p>No hay personas con esa búsqueda.</p>}</div>
            {audienceCount > 12 && <div className="marketing-campaign-pages"><button type="button" className="secondary" disabled={audiencePage === 0} onClick={() => setAudiencePage((value) => value - 1)}>Anterior</button><span>{audiencePage + 1} / {Math.ceil(audienceCount / 12)}</span><button type="button" className="secondary" disabled={(audiencePage + 1) * 12 >= audienceCount} onClick={() => setAudiencePage((value) => value + 1)}>Siguiente</button></div>}
          </div>}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" type="submit" disabled={busy}>{busy ? "Procesando…" : "Guardar borrador"}</button>
        </form>
        {id && <div className="marketing-campaign-send"><label>Correo de prueba<input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="tu@email.com" /></label>
          {sentToday !== null && <p className="marketing-campaign-quota">Hoy salieron {sentToday} correos de campañas. El plan gratis de Resend permite {DAILY_MAIL_LIMIT} por día entre campañas y pedidos.</p>}
          <div className="marketing-campaign-actions"><button className="secondary" type="button" disabled={busy || !testEmail} onClick={() => void sendTest()}>Enviar prueba</button>{(batch || audienceChoice !== "segment") && <button className="primary" type="button" disabled={busy} onClick={() => void send()}>{batch ? `Enviar tanda ${batch.number} de ${batch.total}` : "Enviar campaña"}</button>}{!batch && <button className="secondary" type="button" disabled={busy} onClick={() => void removeDraft("one")}>Eliminar borrador</button>}</div>{progress && <p role="status">{progress}</p>}</div>}
      </section>
      <aside className="marketing-campaign-live-preview"><h2>Vista previa del correo</h2><p>Asunto: {subject || "Asunto de la campaña"}</p><PreviewFrame title="Vista previa de la campaña" html={previewHtml} /></aside>
    </div>}
  </div>;
}
