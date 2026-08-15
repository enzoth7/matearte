import { useMemo, useState } from "react";
import { DownloadSimpleIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { downloadCsv, normalizeText } from "../lib/format";
import type { DashboardData } from "../types";

type HistoryFilter = "Todos" | "Completados" | "Pendientes";
type HistoryStatus = "Completado" | "Pendiente";
const displayValue = (value: string | number | null | undefined) => String(value ?? "").trim() || "-";
const getStatus = (completedAt: string | null): HistoryStatus => completedAt ? "Completado" : "Pendiente";
const formatHistoryDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};
const formatStatusDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function HistoryView({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("Todos");

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return [...data.history].filter((item) => {
      const status = getStatus(item.completedAt);
      const matchesFilter = filter === "Todos" || (filter === "Completados" ? status === "Completado" : status === "Pendiente");
      const searchable = normalizeText(`${item.orderId ?? ""} ${item.customer ?? ""} ${item.model ?? ""} ${item.variant ?? ""} ${status}`);
      return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery));
    }).sort((a, b) => (b.createdAt ? Date.parse(b.createdAt) : 0) - (a.createdAt ? Date.parse(a.createdAt) : 0));
  }, [data.history, filter, query]);

  const exportHistory = () => downloadCsv("matearte-historico.csv", [
    ["ID Pedido", "Fecha creación", "Cliente", "Modelo", "Variante", "Cantidad", "Estado", "Fecha completado"],
    ...filtered.map((item) => [
      displayValue(item.orderId),
      formatHistoryDate(item.createdAt),
      displayValue(item.customer),
      displayValue(item.model),
      displayValue(item.variant),
      displayValue(item.quantity),
      getStatus(item.completedAt),
      formatHistoryDate(item.completedAt),
    ]),
  ]);

  return (
    <div className="page-stack history-page">
      <PageHeader title="Resumen histórico" description="Se actualiza automáticamente desde Producción." actions={
        <button type="button" className="button-secondary" onClick={exportHistory}><DownloadSimpleIcon size={18} aria-hidden="true" /> Exportar CSV</button>
      } />
      <section className="panel table-panel history-panel">
        <div className="table-toolbar">
          <div className="search-field"><MagnifyingGlassIcon size={19} aria-hidden="true" /><label className="sr-only" htmlFor="history-search">Buscar histórico</label><input id="history-search" type="search" value={query} placeholder="Buscar cliente, pedido o producto" onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="filter-tabs" aria-label="Filtrar histórico">
            {(["Todos", "Completados", "Pendientes"] as HistoryFilter[]).map((status) => <button type="button" key={status} className={filter === status ? "is-active" : ""} onClick={() => setFilter(status)}>{status}</button>)}
          </div>
        </div>
        {filtered.length ? (
          <div className="responsive-table-wrap">
            <table className="data-table history-table">
              <colgroup>
                <col className="history-col-created" />
                <col className="history-col-order" />
                <col className="history-col-customer" />
                <col className="history-col-model" />
                <col className="history-col-variant" />
                <col className="history-col-quantity" />
                <col className="history-col-status" />
              </colgroup>
              <thead><tr><th>Creado</th><th>Pedido</th><th>Cliente</th><th>Modelo</th><th>Variante</th><th>Cantidad</th><th>Estado</th></tr></thead>
              <tbody>
                {filtered.map((item) => {
                  const status = getStatus(item.completedAt);
                  return (
                    <tr key={`${item.lineId}-${item.customer}-${item.completedAt}`}>
                      <td data-label="Creado">{formatHistoryDate(item.createdAt)}</td>
                      <td data-label="Pedido">{displayValue(item.orderId)}</td>
                      <td data-label="Cliente">{displayValue(item.customer)}</td>
                      <td data-label="Modelo">{displayValue(item.model)}</td>
                      <td data-label="Variante">{displayValue(item.variant)}</td>
                      <td data-label="Cantidad" className="history-quantity">{displayValue(item.quantity)}</td>
                      <td data-label="Estado">
                        <div className="history-state">
                          <strong className={`history-status status-${status.toLocaleLowerCase("es")}`}>{status}</strong>
                          {status === "Completado" && <time dateTime={item.completedAt ?? undefined}>{formatStatusDate(item.completedAt)}</time>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No hay registros" description="Cambiá el filtro o la búsqueda." />}
      </section>
    </div>
  );
}
