import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CaretDownIcon, CaretUpDownIcon, CaretUpIcon, CheckCircleIcon, DownloadSimpleIcon, MagnifyingGlassIcon, PencilSimpleIcon, PrinterIcon, XIcon } from "@phosphor-icons/react";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { exportProductionToExcel, findProduct, formatArg, formatDate, formatNumber, getLineValueArg, normalizeText } from "../lib/format";
import { exportProductionToPdf } from "../lib/pdfExport";
import type { DashboardData, ProductionItem, ProductionStatus } from "../types";

type StatusFilter = "Todos" | ProductionStatus;
type ProductionSection = "pedidos" | "modelos" | "variantes" | "virolas" | "cueros";
type SortKey = "quantity" | "total" | "date";
type SortDirection = "asc" | "desc";

interface ProductionViewProps {
  data: DashboardData;
  onUpdate: (item: ProductionItem) => Promise<unknown>;
  onComplete: (lineId: string) => Promise<unknown>;
}

interface StateTotals {
  pending: number;
  inProduction: number;
  total: number;
}

interface SummaryRow extends StateTotals {
  key: string;
  label: string;
  secondary?: string;
  tone?: string;
}

const sectionLabels: Array<{ id: ProductionSection; label: string }> = [
  { id: "pedidos", label: "Pedidos" },
  { id: "modelos", label: "Modelos" },
  { id: "variantes", label: "Modelo y variante" },
  { id: "virolas", label: "Virolas" },
  { id: "cueros", label: "Cueros Torpedo" },
];

function SortableHeader({ label, sortKey, activeKey, direction, onSort }: { label: string; sortKey: SortKey; activeKey: SortKey; direction: SortDirection; onSort: (key: SortKey) => void }) {
  const active = activeKey === sortKey;
  const Icon = !active ? CaretUpDownIcon : direction === "asc" ? CaretUpIcon : CaretDownIcon;
  return (
    <th aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="production-sort-button" onClick={() => onSort(sortKey)} aria-label={`Ordenar ${label} ${active && direction === "desc" ? "de menor a mayor" : "de mayor a menor"}`}>
        {label}<Icon size={17} weight="bold" aria-hidden="true" />
      </button>
    </th>
  );
}

function SelectFilterHeader({ label, allLabel, value, options, onChange }: { label: string; allLabel: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <th>
      <label className={`production-header-filter ${value ? "is-filtered" : ""}`} title={value ? `${label}: ${value}` : `Filtrar por ${label.toLocaleLowerCase("es")}`}>
        <strong>{value ? `${label}: ${value}` : label}</strong>
        <CaretDownIcon size={17} weight="bold" aria-hidden="true" />
        <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={`Filtrar por ${label.toLocaleLowerCase("es")}`}>
          <option value="">{allLabel}</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    </th>
  );
}

const toneForModel = (model: string) => {
  const normalized = normalizeText(model);
  if (normalized.includes("bombilla") && !normalized.includes("bombillon")) return "bombilla";
  if (normalized.includes("bombillon")) return "bombillon";
  if (normalized.includes("camionero")) return "camionero";
  if (normalized.includes("criollo")) return "criollo";
  if (normalized.includes("imperial")) return "imperial";
  if (normalized.includes("torpedo")) return "torpedo";
  return "neutral";
};

const totalsFor = (items: ProductionItem[]): StateTotals => {
  const pending = items.reduce((sum, item) => sum + (item.status === "Pendiente" ? item.quantity : 0), 0);
  const inProduction = items.reduce((sum, item) => sum + (item.status === "En producción" ? item.quantity : 0), 0);
  return { pending, inProduction, total: pending + inProduction };
};

const groupRows = (
  items: ProductionItem[],
  getKey: (item: ProductionItem) => { key: string; label: string; secondary?: string; tone?: string },
) => {
  const groups = new Map<string, { meta: ReturnType<typeof getKey>; items: ProductionItem[] }>();
  items.forEach((item) => {
    const meta = getKey(item);
    const current = groups.get(meta.key);
    if (current) current.items.push(item);
    else groups.set(meta.key, { meta, items: [item] });
  });
  return Array.from(groups.values()).map(({ meta, items: groupedItems }): SummaryRow => ({ ...meta, ...totalsFor(groupedItems) }));
};

export const buildProductionSummary = (data: DashboardData) => {
  const modelRows = groupRows(data.production, (item) => ({
    key: normalizeText(item.model),
    label: item.model || "-",
    tone: toneForModel(item.model),
  })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));

  const variantRows = groupRows(data.production, (item) => ({
    key: `${normalizeText(item.model)}|${normalizeText(item.variant)}`,
    label: item.model || "-",
    secondary: item.variant || "-",
    tone: toneForModel(item.model),
  })).sort((a, b) => a.label.localeCompare(b.label, "es") || (a.secondary ?? "").localeCompare(b.secondary ?? "", "es"));

  const rimItems = data.production.filter((item) => {
    const rimType = findProduct(data.products, item)?.rimType?.trim();
    return Boolean(rimType && rimType !== "-");
  });
  const rimRows = groupRows(rimItems, (item) => {
    const rimType = findProduct(data.products, item)?.rimType || "-";
    return { key: normalizeText(rimType), label: rimType };
  }).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));

  const torpedoItems = data.production.filter((item) => normalizeText(item.model) === "torpedo");
  const leatherRows = groupRows(torpedoItems, (item) => {
    const leatherType = findProduct(data.products, item)?.leatherType || "-";
    return { key: normalizeText(leatherType), label: leatherType };
  }).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));

  return { totals: totalsFor(data.production), modelRows, variantRows, rimRows, leatherRows };
};

function SummaryTable({ title, firstColumn, rows, showModel = false }: { title: string; firstColumn: string; rows: SummaryRow[]; showModel?: boolean }) {
  const totals = rows.reduce<StateTotals>((sum, row) => ({
    pending: sum.pending + row.pending,
    inProduction: sum.inProduction + row.inProduction,
    total: sum.total + row.total,
  }), { pending: 0, inProduction: 0, total: 0 });

  if (!rows.length) return <EmptyState title="No hay datos para esta vista" description="Se completará cuando existan pedidos activos." />;

  return (
    <section className="panel production-summary-panel" aria-labelledby={`summary-${title}`}>
      <header><h2 id={`summary-${title}`}>{title}</h2></header>
      <div className="responsive-table-wrap">
        <table className={`data-table production-summary-table ${showModel ? "has-model-column" : ""}`}>
          <thead><tr>{showModel && <th>Modelo</th>}<th>{firstColumn}</th><th>Pendiente</th><th>En producción</th><th>Total</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={`model-tone-${row.tone ?? "neutral"}`}>
                {showModel && <th scope="row" data-label="Modelo">{row.label}</th>}
                <td data-label={firstColumn}>{showModel ? row.secondary : row.label}</td>
                <td data-label="Pendiente">{formatNumber(row.pending)}</td>
                <td data-label="En producción">{formatNumber(row.inProduction)}</td>
                <td data-label="Total"><strong>{formatNumber(row.total)}</strong></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><th colSpan={showModel ? 2 : 1}>Total</th><td>{formatNumber(totals.pending)}</td><td>{formatNumber(totals.inProduction)}</td><td>{formatNumber(totals.total)}</td></tr></tfoot>
        </table>
      </div>
    </section>
  );
}

function ProductionSectionPanel({ section, summary, selectedModel, onSelectModel }: {
  section: ProductionSection;
  summary: ReturnType<typeof buildProductionSummary>;
  selectedModel: string;
  onSelectModel: (model: string) => void;
}) {
  if (section === "modelos") {
    return (
      <section className="production-model-view" aria-label="Unidades por modelo">
        <div className="production-kpi-grid">
          {summary.modelRows.map((row) => (
            <button
              key={row.key}
              type="button"
              className={`production-model-kpi model-tone-${row.tone} ${selectedModel === row.label ? "is-selected" : ""}`}
              aria-pressed={selectedModel === row.label}
              aria-label={`Filtrar valor ARG por ${row.label}`}
              onClick={() => onSelectModel(row.label)}
            >
              <strong>{formatNumber(row.total)}</strong>
              <h2>{row.label}</h2>
              <dl><div><dt>Pendiente</dt><dd>{formatNumber(row.pending)}</dd></div><div><dt>En producción</dt><dd>{formatNumber(row.inProduction)}</dd></div></dl>
            </button>
          ))}
        </div>
      </section>
    );
  }
  if (section === "variantes") return <SummaryTable title="Unidades por modelo y variante" firstColumn="Variante" rows={summary.variantRows} showModel />;
  if (section === "virolas") return <SummaryTable title="Unidades por tipo de virola" firstColumn="Tipo de virola" rows={summary.rimRows} />;
  return <SummaryTable title="Unidades por tipo de cuero — Torpedo" firstColumn="Tipo de cuero" rows={summary.leatherRows} />;
}

export function ProductionView({ data, onUpdate, onComplete }: ProductionViewProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");
  const [customerFilter, setCustomerFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [section, setSection] = useState<ProductionSection>("pedidos");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [editingItem, setEditingItem] = useState<ProductionItem | null>(null);
  const [savingLine, setSavingLine] = useState("");
  const normalizedQuery = normalizeText(query);
  const summary = useMemo(() => buildProductionSummary(data), [data]);
  const availableModels = useMemo(() => Array.from(new Set(data.products.map((p) => p.model))), [data.products]);
  const availableVariants = useMemo(() => data.products.filter((p) => p.model === editingItem?.model), [data.products, editingItem?.model]);
  const customerOptions = useMemo(() => Array.from(new Set(
    data.production
      .filter((item) => !modelFilter || item.model === modelFilter)
      .map((item) => item.customer)
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, "es")), [data.production, modelFilter]);
  const modelOptions = useMemo(() => Array.from(new Set(
    data.production
      .filter((item) => !customerFilter || item.customer === customerFilter)
      .map((item) => item.model)
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, "es")), [customerFilter, data.production]);

  useEffect(() => {
    if (customerFilter && !customerOptions.includes(customerFilter)) setCustomerFilter("");
  }, [customerFilter, customerOptions]);

  useEffect(() => {
    if (modelFilter && !modelOptions.includes(modelFilter)) setModelFilter("");
  }, [modelFilter, modelOptions]);

  const baseFiltered = data.production.filter((item) => {
    const matchesCustomer = !customerFilter || item.customer === customerFilter;
    const matchesModel = !modelFilter || item.model === modelFilter;
    const searchable = normalizeText(`${item.orderId ?? "legado"} ${item.customer} ${item.model} ${item.variant}`);
    return matchesCustomer && matchesModel && (!normalizedQuery || searchable.includes(normalizedQuery));
  });

  const counts = {
    Todos: baseFiltered.length,
    Pendiente: baseFiltered.filter((item) => item.status === "Pendiente").length,
    "En producción": baseFiltered.filter((item) => item.status === "En producción").length,
  };

  const filtered = baseFiltered.filter((item) => statusFilter === "Todos" || item.status === statusFilter);

  const filteredValueArg = filtered.reduce((sum, item) => sum + getLineValueArg(data.products, item), 0);
  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sortKey === "date") {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
    }
    const valueFor = (item: ProductionItem) => sortKey === "quantity" ? item.quantity : getLineValueArg(data.products, item);
    const aValue = valueFor(a);
    const bValue = valueFor(b);
    const comparison = aValue - bValue;
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const requestSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const selectModelFromKpi = (model: string) => {
    const nextModel = modelFilter === model ? "" : model;
    if (nextModel && customerFilter && !data.production.some((item) => item.model === nextModel && item.customer === customerFilter)) {
      setCustomerFilter("");
    }
    setModelFilter(nextModel);
  };

  const openEditor = (item: ProductionItem) => {
    const matchingProducts = data.products.filter((p) => p.model === item.model);
    const variantExists = matchingProducts.some((p) => p.variant === item.variant);
    const safeVariant = variantExists ? item.variant : (matchingProducts[0]?.variant || item.variant);
    setEditingItem({ ...item, variant: safeVariant });
  };

  const closeEditor = () => { if (!savingLine) setEditingItem(null); };
  const updateDraft = <K extends keyof ProductionItem>(field: K, value: ProductionItem[K]) => setEditingItem((current) => current ? { ...current, [field]: value } : current);

  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingItem) return;
    const item = { ...editingItem, orderId: editingItem.orderId?.trim() || null, customer: editingItem.customer.trim(), model: editingItem.model.trim(), variant: editingItem.variant.trim(), quantity: Math.max(1, editingItem.quantity) };
    setSavingLine(item.lineId);
    try { await onUpdate(item); setEditingItem(null); } finally { setSavingLine(""); }
  };

  let content: ReactNode;
  if (section === "pedidos") {
    content = (
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-field"><MagnifyingGlassIcon size={19} aria-hidden="true" /><label className="sr-only" htmlFor="production-search">Buscar en producción</label><input id="production-search" type="search" value={query} placeholder="Buscar cliente, pedido o producto" onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="filter-tabs" aria-label="Filtrar por estado">{(["Todos", "Pendiente", "En producción"] as StatusFilter[]).map((status) => <button type="button" key={status} className={statusFilter === status ? "is-active" : ""} onClick={() => setStatusFilter(status)}>{status} <strong>{counts[status]}</strong></button>)}</div>
        </div>
        {data.production.length ? <div className="responsive-table-wrap"><table className="data-table production-table"><thead><tr>
          <th>Pedido</th>
          <SortableHeader label="Fecha" sortKey="date" activeKey={sortKey} direction={sortDirection} onSort={requestSort} />
          <SelectFilterHeader label="Cliente" allLabel="Ver todos los clientes" value={customerFilter} options={customerOptions} onChange={setCustomerFilter} />
          <SelectFilterHeader label="Modelo" allLabel="Ver todos los modelos" value={modelFilter} options={modelOptions} onChange={setModelFilter} />
          <th>Variante</th>
          <SortableHeader label="Cantidad" sortKey="quantity" activeKey={sortKey} direction={sortDirection} onSort={requestSort} />
          <th>Estado</th>
          <SortableHeader label="Total ARG" sortKey="total" activeKey={sortKey} direction={sortDirection} onSort={requestSort} />
          <th>Acción</th>
        </tr></thead><tbody>{sortedFiltered.map((item) => (
          <tr key={item.lineId} className={savingLine === item.lineId ? "is-saving" : ""}>
            <td data-label="Pedido">{item.orderId || "-"}</td><td data-label="Fecha" className="date-cell">{formatDate(item.createdAt ?? null)}</td><td data-label="Cliente">{item.customer || "-"}</td><td data-label="Modelo">{item.model || "-"}</td><td data-label="Variante">{item.variant || "-"}</td><td data-label="Cantidad" className="number-cell">{item.quantity}</td><td data-label="Estado"><strong className={`status-pill ${item.status === "Pendiente" ? "is-pending" : "is-progress"}`}>{item.status}</strong></td><td data-label="Total ARG" className="money-cell">{formatArg(getLineValueArg(data.products, item))}</td>
            <td className="action-cell"><div className="production-row-actions"><button type="button" className="complete-button" onClick={() => onComplete(item.lineId)} aria-label={`Completar ${item.model} de ${item.customer}`}><CheckCircleIcon size={19} weight="bold" aria-hidden="true" /> <span className="complete-label">Completar</span></button><button type="button" className="edit-line-button" onClick={() => openEditor(item)} aria-label={`Editar ${item.model} de ${item.customer}`} title="Editar línea"><PencilSimpleIcon size={20} weight="bold" aria-hidden="true" /></button></div></td>
          </tr>
        ))}{!sortedFiltered.length && <tr className="production-empty-row"><td colSpan={9}>No encontramos resultados con estos filtros.</td></tr>}</tbody></table></div> : <EmptyState title="No hay pedidos activos" description="Los pedidos nuevos aparecerán en esta vista." />}
      </section>
    );
  } else content = <ProductionSectionPanel section={section} summary={summary} selectedModel={modelFilter} onSelectModel={selectModelFromKpi} />;

  return (
    <div className="page-stack production-page">
      <PageHeader title="Producción" description="Seguimiento y análisis de todas las unidades activas." actions={
        <>
          <button type="button" className="button-secondary" onClick={() => exportProductionToPdf(sortedFiltered)}>
            <PrinterIcon size={18} aria-hidden="true" /> Imprimir PDF
          </button>
          <button type="button" className="button-secondary" onClick={() => exportProductionToExcel(sortedFiltered, data.products, data.exchangeRate)}>
            <DownloadSimpleIcon size={18} aria-hidden="true" /> Exportar Excel
          </button>
          <article className="production-value-kpi" aria-live="polite">
            <p>Valor</p>
            <strong>{formatArg(filteredValueArg)}</strong>
          </article>
        </>
      } />
      <nav className="production-subnav" aria-label="Vistas de producción" role="tablist">
        {sectionLabels.map((item) => <button key={item.id} type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? "is-active" : ""} onClick={() => setSection(item.id)}>{item.label}</button>)}
      </nav>
      {content}

      {editingItem && <div className="customer-dialog-layer" onMouseDown={(event) => event.target === event.currentTarget && closeEditor()}><dialog className="customer-dialog production-edit-dialog" open aria-modal="true" aria-labelledby="production-dialog-title" onCancel={closeEditor}><form onSubmit={saveItem}>
        <header><div><h2 id="production-dialog-title">Editar línea</h2><p>Actualizá solamente los datos necesarios.</p></div><button type="button" className="icon-button" aria-label="Cerrar" onClick={closeEditor}><XIcon size={20} aria-hidden="true" /></button></header>
        <div className="customer-dialog-fields">
          <label htmlFor="production-order">
            Pedido
            <input id="production-order" value={editingItem.orderId ?? ""} onChange={(event) => updateDraft("orderId", event.target.value)} autoFocus />
          </label>
          <label htmlFor="production-customer">
            Cliente
            <input id="production-customer" value={editingItem.customer} onChange={(event) => updateDraft("customer", event.target.value)} required />
          </label>
          <label htmlFor="production-model">
            Modelo
            <select
              id="production-model"
              value={editingItem.model}
              onChange={(event) => {
                const newModel = event.target.value;
                const matchingProducts = data.products.filter((p) => p.model === newModel);
                const firstVariant = matchingProducts[0]?.variant || "";
                setEditingItem((curr) => curr ? { ...curr, model: newModel, variant: firstVariant } : curr);
              }}
              required
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label htmlFor="production-variant">
            Variante
            <select
              id="production-variant"
              value={editingItem.variant}
              onChange={(event) => updateDraft("variant", event.target.value)}
              required
            >
              {availableVariants.map((v) => (
                <option key={v.id} value={v.variant}>{v.variant}</option>
              ))}
            </select>
          </label>
          <label htmlFor="production-quantity">
            Cantidad
            <input id="production-quantity" type="number" min="1" value={editingItem.quantity} onChange={(event) => updateDraft("quantity", Number(event.target.value))} required />
          </label>
          <label htmlFor="production-status">
            Estado
            <select id="production-status" value={editingItem.status} onChange={(event) => updateDraft("status", event.target.value as ProductionStatus)}>
              <option value="Pendiente">Pendiente</option>
              <option value="En producción">En producción</option>
            </select>
          </label>
        </div>
        <footer><button type="button" className="button-quiet" onClick={closeEditor}>Cancelar</button><button type="submit" className="button-primary" disabled={Boolean(savingLine)}>{savingLine ? "Guardando…" : "Guardar cambios"}</button></footer>
      </form></dialog></div>}
    </div>
  );
}
