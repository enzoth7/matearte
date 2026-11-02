import { useCallback, useEffect, useState } from "react";
import { callMarketing } from "./marketingApi";
import { formatDate } from "./dateFormat";
import { countryDisplayName } from "./location";
import { describeSegment, type AccountFilter, type PurchaseFilter, type SegmentContact, type SegmentFilters } from "../../shared/marketingSegments";

export type SavedSegment = { id: string; name: string; filters: SegmentFilters; updated_at: string };
type Options = { sources: string[]; countries: string[]; channels: string[] };
type Preview = { count: number; sample: SegmentContact[] };
type ListKey = "sources" | "countries" | "channels";
type NumberKey = "minPurchases" | "lastPurchaseOlderThanDays" | "lastPurchaseWithinDays";

const number = (value: number) => value.toLocaleString("es-UY");
const emptyOptions: Options = { sources: [], countries: [], channels: [] };

function Choices({ legend, values, selected, label, onToggle }: { legend: string; values: string[]; selected: string[]; label?: (value: string) => string; onToggle: (value: string) => void }) {
  if (!values.length) return null;
  return <fieldset className="marketing-segment-choices"><legend>{legend}</legend>
    {values.map((value) => <label key={value} className="marketing-segment-chip"><input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} />{label ? label(value) : value}</label>)}
  </fieldset>;
}

export function SegmentsPage({ notify }: { notify: (message: string) => void }) {
  const [segments, setSegments] = useState<SavedSegment[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [options, setOptions] = useState<Options>(emptyOptions);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [filters, setFilters] = useState<SegmentFilters>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const result = await callMarketing<{ segments: SavedSegment[]; total: number; options: Options }>("segments");
    setSegments(Array.isArray(result.segments) ? result.segments : []);
    setTotal(typeof result.total === "number" ? result.total : 0);
    setOptions({ sources: result.options?.sources || [], countries: result.options?.countries || [], channels: result.options?.channels || [] });
  }, []);
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, [load]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      void callMarketing<Preview>("segmentPreview", { filters })
        .then((result) => { if (active) { setPreview({ count: result.count ?? 0, sample: Array.isArray(result.sample) ? result.sample : [] }); setError(""); } })
        .catch((reason) => { if (active) setError(reason.message); })
        .finally(() => { if (active) setPreviewLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [filters]);

  const toggle = (key: ListKey, value: string) => setFilters((current) => {
    const list = current[key] || [];
    const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
    const { [key]: _old, ...rest } = current;
    return next.length ? { ...rest, [key]: next } : rest;
  });
  const setNumber = (key: NumberKey, raw: string) => setFilters((current) => {
    const { [key]: _old, ...rest } = current;
    const value = Math.floor(Number(raw));
    return raw.trim() && Number.isFinite(value) && value >= 1 ? { ...rest, [key]: value } : rest;
  });
  const setPurchase = (purchase: PurchaseFilter) => setFilters((current) => {
    const { purchase: _old, minPurchases: _min, lastPurchaseOlderThanDays: _older, lastPurchaseWithinDays: _within, ...rest } = current;
    return purchase === "any" ? rest : purchase === "never" ? { ...rest, purchase } : { ...current, purchase };
  });
  const setAccount = (account: AccountFilter) => setFilters((current) => {
    const { account: _old, ...rest } = current;
    return account === "any" ? rest : { ...rest, account };
  });

  const choose = (segment: SavedSegment | null) => {
    setSelectedId(segment?.id || ""); setName(segment?.name || ""); setFilters(segment?.filters || {}); setError("");
  };
  const save = async () => {
    setBusy(true); setError("");
    try {
      const result = await callMarketing<{ id: string }>("saveSegment", { id: selectedId || undefined, name, filters });
      setSelectedId(result.id); await load(); notify("Segmento guardado.");
    } catch (reason) { setError((reason as Error).message); }
    setBusy(false);
  };
  const remove = async () => {
    if (!selectedId || !window.confirm(`¿Eliminar el segmento “${name}”? Las campañas ya creadas no se modifican.`)) return;
    setBusy(true); setError("");
    try { await callMarketing("deleteSegment", { id: selectedId }); choose(null); await load(); notify("Segmento eliminado."); }
    catch (reason) { setError((reason as Error).message); }
    setBusy(false);
  };

  const purchase = filters.purchase || "any";
  const summary = describeSegment(filters);
  return <div className="marketing-segments-page">
    <aside className="marketing-panel marketing-segments-list" aria-label="Segmentos guardados">
      <div className="marketing-segments-heading"><h2>Segmentos</h2><button type="button" className="secondary" onClick={() => choose(null)}>Nuevo</button></div>
      <p>{total === null ? "Cargando…" : `${number(total)} personas con correo pueden recibir campañas.`} Quienes se dieron de baja nunca se incluyen.</p>
      {segments.map((segment) => <button type="button" key={segment.id} className={`marketing-segment-row${segment.id === selectedId ? " active" : ""}`} onClick={() => choose(segment)}>
        <strong>{segment.name}</strong><small>{describeSegment(segment.filters).join(" · ") || "Todas las personas"}</small>
      </button>)}
      {!segments.length && total !== null && <p>Todavía no guardaste segmentos.</p>}
    </aside>
    <section className="marketing-panel marketing-segment-editor">
      <h2>{selectedId ? "Editar segmento" : "Nuevo segmento"}</h2>
      <p className="marketing-segment-help">Combiná criterios para ordenar a quién le toca cada envío. Sin criterios, el segmento incluye a todas las personas con correo.</p>
      <label className="marketing-segment-name">Nombre<input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Compraron hace más de 90 días" /></label>
      <div className="marketing-segment-selects">
        <label>Compras<select aria-label="Compras" value={purchase} onChange={(event) => setPurchase(event.target.value as PurchaseFilter)}><option value="any">Todas las personas</option><option value="bought">Ya compraron</option><option value="never">Nunca compraron</option></select></label>
        <label>Cuenta en la web<select aria-label="Cuenta en la web" value={filters.account || "any"} onChange={(event) => setAccount(event.target.value as AccountFilter)}><option value="any">Con o sin cuenta</option><option value="yes">Con cuenta</option><option value="no">Sin cuenta</option></select></label>
      </div>
      {purchase !== "never" && <div className="marketing-segment-numbers">
        <label>Compras o más<input type="number" min={1} inputMode="numeric" value={filters.minPurchases ?? ""} onChange={(event) => setNumber("minPurchases", event.target.value)} placeholder="Cualquiera" /></label>
        <label>Última compra hace más de (días)<input type="number" min={1} inputMode="numeric" value={filters.lastPurchaseOlderThanDays ?? ""} onChange={(event) => setNumber("lastPurchaseOlderThanDays", event.target.value)} placeholder="Cualquiera" /></label>
        <label>Última compra en los últimos (días)<input type="number" min={1} inputMode="numeric" value={filters.lastPurchaseWithinDays ?? ""} onChange={(event) => setNumber("lastPurchaseWithinDays", event.target.value)} placeholder="Cualquiera" /></label>
      </div>}
      <Choices legend="Origen" values={options.sources} selected={filters.sources || []} onToggle={(value) => toggle("sources", value)} />
      <Choices legend="País" values={options.countries} selected={filters.countries || []} label={countryDisplayName} onToggle={(value) => toggle("countries", value)} />
      <Choices legend="Canal de la última compra" values={options.channels} selected={filters.channels || []} onToggle={(value) => toggle("channels", value)} />
      {error && <p className="error" role="alert">{error}</p>}
      <p className="marketing-segment-live" aria-live="polite"><strong>{preview ? number(preview.count) : "…"}</strong> {preview?.count === 1 ? "persona cumple" : "personas cumplen"} estos criterios</p>
      <div className="marketing-segment-actions">
        <button type="button" className="primary" disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? "Procesando…" : "Guardar segmento"}</button>
        {selectedId && <button type="button" className="secondary" disabled={busy} onClick={() => void remove()}>Eliminar</button>}
      </div>
    </section>
    <section className="marketing-panel marketing-segment-result" aria-live="polite" aria-label="Resultado del segmento">
      <h2>Resultado</h2>
      <p className="marketing-segment-count"><strong>{preview ? number(preview.count) : "…"}</strong> {preview?.count === 1 ? "persona" : "personas"}{total !== null && <> de {number(total)}</>}{previewLoading && <small> · actualizando…</small>}</p>
      {summary.length > 0 && <p className="marketing-segment-summary">{summary.join(" · ")}</p>}
      {preview && preview.sample.length > 0 && <div className="marketing-directory marketing-segment-directory"><div className="table-wrap"><table className="data-table marketing-directory-table marketing-segment-table"><caption>Primeras {preview.sample.length}, ordenadas por última compra</caption><thead><tr><th>Persona</th><th>Origen</th><th>País</th><th>Compras</th><th>Última compra</th></tr></thead><tbody>
        {preview.sample.map((person) => <tr key={person.email}><td data-label="Persona"><strong>{person.name || person.email}</strong>{person.name && <small>{person.email}</small>}</td><td data-label="Origen">{person.source || "—"}</td><td data-label="País">{person.country ? countryDisplayName(person.country) : "—"}</td><td data-label="Compras">{person.purchase_count}</td><td data-label="Última compra">{person.last_purchase_at ? formatDate(person.last_purchase_at) : "—"}</td></tr>)}
      </tbody></table></div></div>}
      {preview && preview.count === 0 && <p className="marketing-directory-empty">Nadie cumple con estos criterios.</p>}
    </section>
  </div>;
}
