import { ArrowClockwiseIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchRetailProduction,
  RETAIL_PRODUCTION_STATUS_LABELS,
  type RetailProductionItem,
  type RetailProductionStatus,
  type RetailSource,
  updateRetailProductionStatus,
} from "../lib/retailProduction";

type SourceFilter = "Todos" | RetailSource;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

export function RetailPanelView() {
  const [items, setItems] = useState<RetailProductionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("Todos");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [statusErrors, setStatusErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await fetchRetailProduction());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la producción minorista.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => ({
    Todos: items.length,
    Web: items.filter((item) => item.source === "Web").length,
    Local: items.filter((item) => item.source === "Local").length,
  }), [items]);

  const filteredItems = useMemo(() => {
    const query = normalize(search.trim());
    return items.filter((item) => {
      if (sourceFilter !== "Todos" && item.source !== sourceFilter) return false;
      if (!query) return true;
      return normalize(`${item.reference} ${item.customer} ${item.product} ${RETAIL_PRODUCTION_STATUS_LABELS[item.status]} ${item.source}`).includes(query);
    });
  }, [items, search, sourceFilter]);

  const changeStatus = async (item: RetailProductionItem, status: RetailProductionStatus) => {
    const previousStatus = item.status;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry));
    setSavingIds((current) => new Set(current).add(item.id));
    setStatusErrors((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });

    try {
      await updateRetailProductionStatus(item, status);
    } catch (saveError) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: previousStatus } : entry));
      setStatusErrors((current) => ({
        ...current,
        [item.id]: saveError instanceof Error ? saveError.message : "No se pudo guardar el estado.",
      }));
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <section className="retail-production page-stack" aria-labelledby="retail-panel-title">
      <header className="page-header retail-panel-header">
        <div className="page-header-copy">
          <p className="retail-section-label">Panel minorista</p>
          <h1 id="retail-panel-title">Producción minorista</h1>
          <p>Pedidos web y ventas del local, reunidos en una vista simple para saber qué se pidió y qué hay que preparar.</p>
        </div>
      </header>

      <section className="panel retail-production-panel" aria-label="Pedidos y ventas minoristas">
        <div className="retail-production-toolbar">
          <label className="search-field retail-production-search">
            <MagnifyingGlassIcon size={20} aria-hidden="true" />
            <span className="sr-only">Buscar pedido, cliente o producto</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar pedido, cliente o producto"
            />
          </label>

          <div className="filter-tabs retail-source-filters" aria-label="Filtrar por origen">
            {(["Todos", "Web", "Local"] as SourceFilter[]).map((source) => (
              <button
                type="button"
                key={source}
                className={sourceFilter === source ? "is-active" : ""}
                aria-pressed={sourceFilter === source}
                onClick={() => setSourceFilter(source)}
              >
                {source} <strong>{counts[source]}</strong>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="retail-production-state" role="status">Cargando producción minorista…</div>
        ) : error ? (
          <div className="retail-production-state retail-production-error" role="alert">
            <strong>No se pudo cargar la producción.</strong>
            <p>{error}</p>
            <button type="button" className="button-quiet" onClick={() => void load()}>
              <ArrowClockwiseIcon size={19} aria-hidden="true" />
              Reintentar
            </button>
          </div>
        ) : (
          <div className="responsive-table-wrap retail-production-table-wrap">
            <table className="data-table retail-production-table">
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Pedido</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Origen"><strong className={`retail-source retail-source-${item.source.toLowerCase()}`}>{item.source}</strong></td>
                    <td data-label="Pedido" className="retail-reference">{item.reference}</td>
                    <td data-label="Fecha"><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></td>
                    <td data-label="Cliente">{item.customer}</td>
                    <td data-label="Producto"><strong>{item.product}</strong></td>
                    <td data-label="Cantidad" className="number-cell">{item.quantity}</td>
                    <td data-label="Estado" className="retail-status-cell">
                      <label className="sr-only" htmlFor={`retail-status-${item.id}`}>Estado de {item.product}</label>
                      <select
                        id={`retail-status-${item.id}`}
                        className={`retail-status-select is-${item.status}`}
                        value={item.status}
                        disabled={savingIds.has(item.id)}
                        aria-describedby={statusErrors[item.id] ? `retail-status-error-${item.id}` : undefined}
                        onChange={(event) => void changeStatus(item, event.target.value as RetailProductionStatus)}
                      >
                        {(Object.entries(RETAIL_PRODUCTION_STATUS_LABELS) as Array<[RetailProductionStatus, string]>).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      {savingIds.has(item.id) && <span className="retail-status-feedback" role="status">Guardando…</span>}
                      {statusErrors[item.id] && (
                        <span id={`retail-status-error-${item.id}`} className="retail-status-error" role="alert">
                          No se pudo guardar. Probá de nuevo.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!filteredItems.length && (
              <div className="retail-production-state">
                <strong>{items.length ? "No hay resultados con esos filtros." : "No hay pedidos minoristas pendientes."}</strong>
                <p>{items.length ? "Probá otra búsqueda o elegí Todos." : "Los nuevos pedidos web y las ventas del local aparecerán acá."}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
