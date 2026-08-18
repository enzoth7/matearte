import { useEffect, useMemo, useState } from "react";
import { CalculatorIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { formatUyu, normalizeText } from "../lib/format";
import type { DashboardData, Product } from "../types";

interface ProductsViewProps {
  data: DashboardData;
  onUpdate: (product: Product) => Promise<unknown>;
  onUpdateExchangeRate: (rate: number) => Promise<unknown>;
}

export function ProductsView({ data, onUpdate, onUpdateExchangeRate }: ProductsViewProps) {
  const [query, setQuery] = useState("");
  const [rate, setRate] = useState(String(data.exchangeRate));
  const [savingProduct, setSavingProduct] = useState("");
  useEffect(() => setRate(String(data.exchangeRate)), [data.exchangeRate]);

  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    return data.products.filter((product) => !normalized || normalizeText(`${product.model} ${product.variant} ${product.rimType} ${product.leatherType}`).includes(normalized));
  }, [data.products, query]);

  const save = async (product: Product, patch: Partial<Product>) => {
    setSavingProduct(product.id);
    try { await onUpdate({ ...product, ...patch }); } finally { setSavingProduct(""); }
  };

  return (
    <div className="page-stack">
      <PageHeader title="Productos" description="Modelo, variante, materiales y precios son editables." />
      <section className="catalog-summary-grid">
        <article className="panel exchange-card">
          <div className="summary-icon"><CalculatorIcon size={24} aria-hidden="true" /></div>
          <h2>Tipo de cambio ARG → UYU</h2>
          <div className="rate-input"><label htmlFor="exchange-rate">1 ARS equivale a</label><div><input id="exchange-rate" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} onBlur={() => onUpdateExchangeRate(Number(rate.replace(",", ".")))} /><strong className="rate-suffix">UYU</strong></div></div>
        </article>
        <article className="panel catalog-count-card"><h2>Catálogo activo</h2><strong>{data.products.length}</strong><p>variantes en {new Set(data.products.map((product) => product.model)).size} modelos</p></article>
      </section>
      <section className="panel table-panel">
        <div className="table-toolbar"><div className="search-field"><MagnifyingGlassIcon size={19} aria-hidden="true" /><label className="sr-only" htmlFor="product-search">Buscar producto</label><input id="product-search" type="search" value={query} placeholder="Buscar modelo, variante o material" onChange={(event) => setQuery(event.target.value)} /></div></div>
        <div className="table-summary"><strong>{filtered.length} productos editables</strong></div>
        {filtered.length ? (
          <div className="responsive-table-wrap">
            <table className="data-table editable-table product-table">
              <thead><tr><th>#</th><th>Modelo</th><th>Variante</th><th>Virola</th><th>Cuero</th><th>Precio ARG</th><th>Precio UYU</th></tr></thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={`${product.id}-${product.model}-${product.priceArg}`} className={savingProduct === product.id ? "is-saving" : ""}>
                    <td data-label="#"><strong>{product.id}</strong></td>
                    <td data-label="Modelo"><input aria-label={`Modelo producto ${product.id}`} defaultValue={product.model} onBlur={(event) => save(product, { model: event.target.value })} /></td>
                    <td data-label="Variante"><input aria-label={`Variante producto ${product.id}`} defaultValue={product.variant} onBlur={(event) => save(product, { variant: event.target.value })} /></td>
                    <td data-label="Virola"><input aria-label={`Virola producto ${product.id}`} defaultValue={product.rimType} onBlur={(event) => save(product, { rimType: event.target.value })} /></td>
                    <td data-label="Cuero"><input aria-label={`Cuero producto ${product.id}`} defaultValue={product.leatherType} onBlur={(event) => save(product, { leatherType: event.target.value })} /></td>
                    <td data-label="Precio ARG"><input aria-label={`Precio ARG producto ${product.id}`} className="numeric-input price-wide" type="number" min="0" defaultValue={Math.round(product.priceArg)} onBlur={(event) => save(product, { priceArg: Number(event.target.value) })} /></td>
                    <td data-label="Precio UYU" className="money-cell">{formatUyu(product.priceArg * data.exchangeRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No encontramos productos" description="Probá con otra búsqueda." />}
      </section>
    </div>
  );
}
