import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { commerceSource } from "./commerceSource";
import { today } from "./data";
import { Plus } from "@phosphor-icons/react";
import { Modal, Stats, Table } from "./ui";
import {
  adCurrencies, adPlatforms, formatMoney, fromMinorText, parseAmount, periodLabel, reportText, summarizeReport,
  type AdCampaign, type AdCurrency, type AdReport,
} from "./adReports";

const columns = "id,period_start,period_end,platform,currency,campaigns,deposit_minor,deposit_on,previous_balance_minor,notes";
const number = (value: number) => new Intl.NumberFormat("es-UY").format(value);

type CampaignDraft = { name: string; conversations: string; cost: string; total: string };
type Draft = {
  period_start: string; period_end: string; platform: string; currency: AdCurrency; campaigns: CampaignDraft[];
  deposit: string; deposit_on: string; previous: string; previous_kind: "pending" | "credit"; notes: string;
};

const emptyCampaign = (): CampaignDraft => ({ name: "", conversations: "", cost: "", total: "" });
const sumLabel = (totals: Partial<Record<AdCurrency, number>>) => {
  const parts = adCurrencies.filter((currency) => totals[currency]).map((currency) => formatMoney(totals[currency]!, currency));
  return parts.length ? parts.join(" + ") : "—";
};

function emptyDraft(previous?: AdReport): Draft {
  const carried = previous ? summarizeReport(previous).newBalance : 0;
  return {
    period_start: "", period_end: today, platform: previous?.platform || "Meta", currency: previous?.currency || "UYU",
    campaigns: [emptyCampaign()], deposit: "", deposit_on: "", previous: carried ? fromMinorText(Math.abs(carried)) : "",
    previous_kind: carried > 0 ? "credit" : "pending", notes: "",
  };
}

const draftOf = (report: AdReport): Draft => ({
  period_start: report.period_start, period_end: report.period_end, platform: report.platform, currency: report.currency,
  campaigns: report.campaigns.map((campaign) => ({ name: campaign.name, conversations: String(campaign.conversations), cost: fromMinorText(campaign.cost_per_conversation_minor), total: fromMinorText(campaign.total_minor) })),
  deposit: report.deposit_minor ? fromMinorText(report.deposit_minor) : "", deposit_on: report.deposit_on || "",
  previous: report.previous_balance_minor ? fromMinorText(Math.abs(report.previous_balance_minor)) : "",
  previous_kind: report.previous_balance_minor > 0 ? "credit" : "pending", notes: report.notes || "",
});

const optionalAmount = (text: string) => text.trim() ? parseAmount(text) : 0;

/** Convierte el formulario en un informe; devuelve el texto del problema si algo no es válido. */
function readDraft(draft: Draft): { report: Omit<AdReport, "id">; error?: undefined } | { error: string; report?: undefined } {
  if (!draft.period_start || !draft.period_end) return { error: "Indicá desde y hasta qué día va el informe." };
  if (draft.period_end < draft.period_start) return { error: "El día final no puede ser anterior al inicial." };
  const campaigns: AdCampaign[] = [];
  for (const row of draft.campaigns) {
    if (!row.name.trim() && !row.conversations && !row.cost && !row.total) continue;
    const conversations = row.conversations.trim() ? Number(row.conversations) : 0;
    const cost = optionalAmount(row.cost);
    const total = parseAmount(row.total);
    if (!row.name.trim()) return { error: "Cada campaña necesita un nombre." };
    if (!Number.isInteger(conversations) || conversations < 0) return { error: `Revisá las conversaciones de "${row.name.trim()}".` };
    if (!Number.isFinite(cost) || cost < 0) return { error: `Revisá el costo por conversación de "${row.name.trim()}".` };
    if (!Number.isFinite(total) || total < 0) return { error: `Falta el total de campaña de "${row.name.trim()}".` };
    campaigns.push({ name: row.name.trim(), conversations, cost_per_conversation_minor: cost, total_minor: total });
  }
  if (!campaigns.length) return { error: "Agregá al menos una campaña." };
  const deposit = optionalAmount(draft.deposit);
  const previous = optionalAmount(draft.previous);
  if (!Number.isFinite(deposit) || deposit < 0) return { error: "Revisá el depósito." };
  if (!Number.isFinite(previous) || previous < 0) return { error: "Revisá el saldo anterior." };
  return {
    report: {
      period_start: draft.period_start, period_end: draft.period_end, platform: draft.platform, currency: draft.currency, campaigns,
      deposit_minor: deposit, deposit_on: draft.deposit_on || null,
      previous_balance_minor: draft.previous_kind === "pending" ? -previous : previous, notes: draft.notes.trim() || null,
    },
  };
}

function ReportCard({ report, onEdit, onDelete, onCopy }: { report: AdReport; onEdit: () => void; onDelete: () => void; onCopy: () => void }) {
  const summary = summarizeReport(report);
  const money = (minor: number) => formatMoney(minor, report.currency);
  return <article className="ad-report" aria-label={`Informe del ${periodLabel(report.period_start, report.period_end)}`}>
    <header>
      <div><small>{report.platform}</small><h3>{periodLabel(report.period_start, report.period_end)}</h3></div>
      <div className="ad-report-total"><small>Total general</small><strong>{money(summary.spend)}</strong></div>
    </header>
    <div className="ad-campaigns" role="table" aria-label="Campañas del informe">
      <div className="ad-campaign ad-campaign-head" role="row"><span role="columnheader">Campaña</span><span role="columnheader">Conversaciones</span><span role="columnheader">Costo por conversación</span><span role="columnheader">Total</span></div>
      {report.campaigns.map((campaign, index) => <div className="ad-campaign" role="row" key={`${campaign.name}-${index}`}>
        <strong role="cell">{campaign.name}</strong>
        <span role="cell" data-label="Conversaciones">{number(campaign.conversations)}</span>
        <span role="cell" data-label="Costo por conversación">{money(campaign.cost_per_conversation_minor)}</span>
        <strong role="cell" data-label="Total">{money(campaign.total_minor)}</strong>
      </div>)}
      <div className="ad-campaign ad-campaign-sum" role="row"><span role="cell">Total</span><span role="cell" data-label="Conversaciones">{number(summary.conversations)}</span><span role="cell" data-label="Costo promedio">{money(summary.averageCostMinor)}</span><strong role="cell" data-label="Total">{money(summary.spend)}</strong></div>
    </div>
    <dl className="ad-funds" aria-label="Disponibilidad de fondos">
      {report.deposit_minor > 0 && <div><dt>Depósito{report.deposit_on ? ` (${new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${report.deposit_on}T00:00:00Z`))})` : ""}</dt><dd>{money(report.deposit_minor)}</dd></div>}
      {report.previous_balance_minor !== 0 && <div><dt>{report.previous_balance_minor < 0 ? "Saldo pendiente anterior" : "Saldo a favor anterior"}</dt><dd>{money(Math.abs(report.previous_balance_minor))}</dd></div>}
      <div><dt>Subtotal</dt><dd>{money(summary.subtotal)}</dd></div>
      <div><dt>Total actual</dt><dd>{money(summary.spend)}</dd></div>
      <div className={summary.newBalance < 0 ? "is-debt" : "is-credit"}><dt>Nuevo saldo</dt><dd>{money(summary.newBalance)}</dd></div>
    </dl>
    {report.notes && <p className="ad-notes"><strong>Importante</strong>{report.notes}</p>}
    <footer className="purchase-actions">
      <button type="button" className="secondary" onClick={onCopy}>Copiar informe</button>
      <button type="button" className="secondary" onClick={onEdit}>Editar</button>
      <button type="button" className="secondary" onClick={onDelete}>Eliminar</button>
    </footer>
  </article>;
}

export function AdReports({ notify }: { notify: (message: string) => void }) {
  const [reports, setReports] = useState<AdReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!commerceSource) return;
    const { data, error } = await commerceSource.from("ad_reports").select(columns).order("period_end", { ascending: false }).order("created_at", { ascending: false }).limit(200);
    if (error) notify("No se pudieron cargar los informes de pauta."); else setReports((data || []) as AdReport[]);
    setLoading(false);
  }, [notify]);
  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const spend: Partial<Record<AdCurrency, number>> = {};
    const conversations: Partial<Record<AdCurrency, number>> = {};
    for (const report of reports) {
      const summary = summarizeReport(report);
      spend[report.currency] = (spend[report.currency] || 0) + summary.spend;
      conversations[report.currency] = (conversations[report.currency] || 0) + summary.conversations;
    }
    const average: Partial<Record<AdCurrency, number>> = {};
    for (const currency of adCurrencies) if (conversations[currency]) average[currency] = Math.round((spend[currency] || 0) / conversations[currency]!);
    // El saldo actual es el del último informe de cada moneda.
    const balance: Partial<Record<AdCurrency, number>> = {};
    for (const report of reports) if (balance[report.currency] === undefined) balance[report.currency] = summarizeReport(report).newBalance;
    return { spend, conversations, average, balance };
  }, [reports]);
  const totalConversations = Object.values(totals.conversations).reduce((sum, value) => sum + (value || 0), 0);
  const hasDebt = Object.values(totals.balance).some((value) => (value || 0) < 0);

  const open = (report?: AdReport) => { setDetailId(null); setFormError(""); setEditing(report ? { id: report.id, draft: draftOf(report) } : { id: null, draft: emptyDraft(reports[0]) }); };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setEditing((current) => current && { ...current, draft: { ...current.draft, [key]: value } });
  const setCampaign = (index: number, patch: Partial<CampaignDraft>) => setEditing((current) => current && { ...current, draft: { ...current.draft, campaigns: current.draft.campaigns.map((row, position) => position === index ? { ...row, ...patch } : row) } });

  const preview = useMemo(() => {
    if (!editing) return null;
    const read = readDraft(editing.draft);
    if (read.report) return { ...summarizeReport(read.report), currency: read.report.currency };
    const loose = editing.draft.campaigns.reduce((sum, row) => { const total = row.total.trim() ? parseAmount(row.total) : 0; return sum + (Number.isFinite(total) ? total : 0); }, 0);
    const deposit = optionalAmount(editing.draft.deposit); const previous = optionalAmount(editing.draft.previous);
    const subtotal = (Number.isFinite(deposit) ? deposit : 0) + (editing.draft.previous_kind === "pending" ? -1 : 1) * (Number.isFinite(previous) ? previous : 0);
    return { spend: loose, conversations: 0, averageCostMinor: 0, subtotal, newBalance: subtotal - loose, currency: editing.draft.currency };
  }, [editing]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !commerceSource) return;
    const read = readDraft(editing.draft);
    if (!read.report) { setFormError(read.error); return; }
    setSaving(true); setFormError("");
    const { error } = editing.id ? await commerceSource.from("ad_reports").update(read.report).eq("id", editing.id) : await commerceSource.from("ad_reports").insert(read.report);
    setSaving(false);
    if (error) { setFormError("No se pudo guardar el informe. Revisá los datos e intentá de nuevo."); return; }
    notify(editing.id ? "Informe actualizado." : "Informe guardado.");
    setEditing(null);
    await load();
  };
  const remove = async (report: AdReport) => {
    if (!commerceSource || !window.confirm(`¿Eliminar el informe del ${periodLabel(report.period_start, report.period_end)}? Esta acción no se puede deshacer.`)) return;
    const { error } = await commerceSource.from("ad_reports").delete().eq("id", report.id);
    if (error) { notify("No se pudo eliminar el informe."); return; }
    notify("Informe eliminado.");
    setDetailId(null);
    await load();
  };
  const copy = async (report: AdReport) => {
    try { await navigator.clipboard.writeText(reportText(report)); notify("Informe copiado para pegarlo donde lo necesites."); }
    catch { notify("No se pudo copiar. Seleccioná el texto manualmente."); }
  };

  if (!commerceSource) return <p className="error" role="alert">El comercio no está conectado.</p>;
  const draft = editing?.draft;
  const detail = reports.find((report) => report.id === detailId) || null;
  return <div className="ad-reports-page">
    <Stats items={[
      { label: "Invertido en pauta", value: sumLabel(totals.spend), tone: "brown", note: reports.length ? `${reports.length} ${reports.length === 1 ? "informe" : "informes"}` : undefined },
      { label: "Conversaciones iniciadas", value: number(totalConversations) },
      { label: "Costo promedio por conversación", value: sumLabel(totals.average) },
      { label: "Saldo actual", value: sumLabel(totals.balance), tone: hasDebt ? "red" : undefined, note: hasDebt ? "Hay saldo pendiente de pago" : undefined },
    ]} />
    {loading ? <p role="status">Cargando informes…</p> : <Table rows={reports} className="ad-reports-table" searchText={(row) => `${periodLabel(row.period_start, row.period_end)} ${row.platform} ${row.campaigns.map((campaign) => campaign.name).join(" ")} ${row.notes || ""}`}
      action={<button type="button" className="primary" onClick={() => open()}>Nuevo informe</button>}
      columns={[
        { label: "Período", render: (row) => <><strong>{periodLabel(row.period_start, row.period_end)}</strong><small className="ad-platform">{row.platform}</small></> },
        { label: "Campañas", render: (row) => <><strong>{row.campaigns.length} {row.campaigns.length === 1 ? "campaña" : "campañas"}</strong><small className="ad-campaign-names">{row.campaigns.map((campaign) => campaign.name).join(" · ")}</small></> },
        { label: "Conversaciones", render: (row) => number(summarizeReport(row).conversations) },
        { label: "Costo por conversación", render: (row) => formatMoney(summarizeReport(row).averageCostMinor, row.currency) },
        { label: "Total invertido", render: (row) => <strong>{formatMoney(summarizeReport(row).spend, row.currency)}</strong> },
        { label: "Depósito", render: (row) => row.deposit_minor ? formatMoney(row.deposit_minor, row.currency) : "—" },
        { label: "Nuevo saldo", render: (row) => { const balance = summarizeReport(row).newBalance; return <span className={balance < 0 ? "ad-balance is-debt" : "ad-balance is-credit"}>{formatMoney(balance, row.currency)}</span>; } },
        { label: "Detalle", render: (row) => <button type="button" className="ad-detail-button" aria-label={`Ver detalle del informe del ${periodLabel(row.period_start, row.period_end)}`} title="Ver detalle" onClick={() => setDetailId(row.id)}><Plus size={18} aria-hidden="true" /></button> },
      ]} />}
    {!loading && !reports.length && <p className="marketing-directory-empty">Todavía no cargaste informes de pauta. Usá “Nuevo informe” para cargar el primero.</p>}
    {detail && <Modal title="Detalle del informe de pauta" onClose={() => setDetailId(null)} className="ad-report-dialog">
      <ReportCard report={detail} onEdit={() => open(detail)} onDelete={() => void remove(detail)} onCopy={() => void copy(detail)} />
    </Modal>}
    {editing && draft && <Modal title={editing.id ? "Editar informe de pauta" : "Nuevo informe de pauta"} onClose={() => setEditing(null)}>
      <form className="purchase-form ad-form" onSubmit={save}>
        <label>Desde<input type="date" required value={draft.period_start} onChange={(event) => set("period_start", event.target.value)} /></label>
        <label>Hasta<input type="date" required value={draft.period_end} onChange={(event) => set("period_end", event.target.value)} /></label>
        <label>Plataforma<select value={draft.platform} onChange={(event) => set("platform", event.target.value)}>{[...new Set([...adPlatforms, draft.platform])].map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Moneda<select value={draft.currency} onChange={(event) => set("currency", event.target.value as AdCurrency)}>{adCurrencies.map((code) => <option key={code}>{code}</option>)}</select></label>

        <fieldset className="purchase-wide ad-campaign-fields">
          <legend>Campañas</legend>
          {draft.campaigns.map((row, index) => <div className="ad-campaign-row" key={index}>
            <label className="ad-campaign-name">Campaña<input aria-label={`Nombre de la campaña ${index + 1}`} maxLength={120} placeholder="Ej.: Botas Iguazú" value={row.name} onChange={(event) => setCampaign(index, { name: event.target.value })} /></label>
            <label>Conversaciones<input aria-label={`Conversaciones de la campaña ${index + 1}`} inputMode="numeric" value={row.conversations} onChange={(event) => setCampaign(index, { conversations: event.target.value })} /></label>
            <label>Costo por conversación<input aria-label={`Costo por conversación de la campaña ${index + 1}`} inputMode="decimal" value={row.cost} onChange={(event) => setCampaign(index, { cost: event.target.value })} /></label>
            <label>Total de campaña<input aria-label={`Total de la campaña ${index + 1}`} inputMode="decimal" value={row.total} onChange={(event) => setCampaign(index, { total: event.target.value })} /></label>
            <button type="button" className="secondary" aria-label={`Quitar la campaña ${index + 1}`} disabled={draft.campaigns.length === 1} onClick={() => setEditing((current) => current && { ...current, draft: { ...current.draft, campaigns: current.draft.campaigns.filter((_, position) => position !== index) } })}>Quitar</button>
          </div>)}
          <button type="button" className="secondary" onClick={() => set("campaigns", [...draft.campaigns, emptyCampaign()])}>Agregar campaña</button>
        </fieldset>

        <fieldset className="purchase-wide ad-funds-fields">
          <legend>Disponibilidad de fondos</legend>
          <label>Depósito realizado<input aria-label="Depósito realizado" inputMode="decimal" value={draft.deposit} onChange={(event) => set("deposit", event.target.value)} /></label>
          <label>Fecha del depósito<input type="date" value={draft.deposit_on} onChange={(event) => set("deposit_on", event.target.value)} /></label>
          <label>Saldo anterior<input aria-label="Saldo anterior" inputMode="decimal" value={draft.previous} onChange={(event) => set("previous", event.target.value)} /></label>
          <label>El saldo anterior era<select aria-label="Tipo de saldo anterior" value={draft.previous_kind} onChange={(event) => set("previous_kind", event.target.value as Draft["previous_kind"])}><option value="pending">Pendiente de pago</option><option value="credit">A favor</option></select></label>
        </fieldset>

        {preview && <dl className="purchase-wide ad-preview" aria-label="Cuentas del informe" aria-live="polite">
          <div><dt>Total general</dt><dd>{formatMoney(preview.spend, preview.currency)}</dd></div>
          <div><dt>Subtotal de fondos</dt><dd>{formatMoney(preview.subtotal, preview.currency)}</dd></div>
          <div className={preview.newBalance < 0 ? "is-debt" : "is-credit"}><dt>Nuevo saldo</dt><dd>{formatMoney(preview.newBalance, preview.currency)}</dd></div>
        </dl>}

        <label className="purchase-wide">Importante (notas)<textarea rows={3} maxLength={2000} placeholder="Cambios que se van a hacer, aclaraciones, etc." value={draft.notes} onChange={(event) => set("notes", event.target.value)} /></label>
        {formError && <div className="purchase-wide error" role="alert">{formError}</div>}
        <div className="purchase-wide purchase-form-actions"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar informe"}</button></div>
      </form>
    </Modal>}
  </div>;
}
