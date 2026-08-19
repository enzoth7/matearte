import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalculatorIcon, MagnifyingGlassIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { formatUyu, normalizeText } from "../lib/format";
import type { DashboardData, Product } from "../types";

export interface AddProductInput {
  model: string;
  variant: string;
  rimType?: string;
  leatherType?: string;
  priceArg: number;
}

interface ProductsViewProps {
  data: DashboardData;
  onAdd: (product: AddProductInput) => Promise<unknown>;
  onUpdate: (product: Product) => Promise<unknown>;
  onUpdateExchangeRate: (rate: number) => Promise<unknown>;
}

const initialProductForm = {
  model: "",
  variant: "",
  rimType: "",
  leatherType: "",
  priceArg: "",
};

export function ProductsView({ data, onAdd, onUpdate, onUpdateExchangeRate }: ProductsViewProps) {
  const [query, setQuery] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [rimFilter, setRimFilter] = useState("");
  const [leatherFilter, setLeatherFilter] = useState("");
  const [rate, setRate] = useState(String(data.exchangeRate));
  const [savingProduct, setSavingProduct] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(initialProductForm);
  const [savingNewProduct, setSavingNewProduct] = useState(false);

  useEffect(() => setRate(String(data.exchangeRate)), [data.exchangeRate]);

  const modelOptions = useMemo(() => {
    return Array.from(new Set(data.products.map((p) => p.model?.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [data.products]);

  const variantOptions = useMemo(() => {
    const source = modelFilter
      ? data.products.filter((p) => p.model === modelFilter)
      : data.products;
    return Array.from(new Set(source.map((p) => p.variant?.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [data.products, modelFilter]);

  const rimOptions = useMemo(() => {
    return Array.from(new Set(data.products.map((p) => p.rimType?.trim()).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [data.products]);

  const leatherOptions = useMemo(() => {
    return Array.from(new Set(data.products.map((p) => p.leatherType?.trim()).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [data.products]);

  useEffect(() => {
    if (variantFilter && !variantOptions.includes(variantFilter)) {
      setVariantFilter("");
    }
  }, [variantFilter, variantOptions]);

  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    return data.products.filter((product) => {
      const matchesQuery =
        !normalized ||
        normalizeText(
          `${product.model} ${product.variant} ${product.rimType ?? ""} ${product.leatherType ?? ""}`
        ).includes(normalized);
      const matchesModel = !modelFilter || product.model === modelFilter;
      const matchesVariant = !variantFilter || product.variant === variantFilter;
      const matchesRim = !rimFilter || (product.rimType?.trim() ?? "") === rimFilter;
      const matchesLeather = !leatherFilter || (product.leatherType?.trim() ?? "") === leatherFilter;

      return matchesQuery && matchesModel && matchesVariant && matchesRim && matchesLeather;
    });
  }, [data.products, query, modelFilter, variantFilter, rimFilter, leatherFilter]);

  const hasActiveFilters = Boolean(
    query || modelFilter || variantFilter || rimFilter || leatherFilter
  );

  const clearFilters = () => {
    setQuery("");
    setModelFilter("");
    setVariantFilter("");
    setRimFilter("");
    setLeatherFilter("");
  };

  const save = async (product: Product, patch: Partial<Product>) => {
    setSavingProduct(product.id);
    try { await onUpdate({ ...product, ...patch }); } finally { setSavingProduct(""); }
  };

  const openAddDialog = () => {
    setForm(initialProductForm);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (savingNewProduct) return;
    setDialogOpen(false);
  };

  const handleAddSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const model = form.model.trim();
    const variant = form.variant.trim();
    if (!model || !variant) return;

    const priceArg = Math.max(0, Number(form.priceArg) || 0);

    setSavingNewProduct(true);
    try {
      await onAdd({
        model,
        variant,
        rimType: form.rimType.trim() || undefined,
        leatherType: form.leatherType.trim() || undefined,
        priceArg,
      });
      setDialogOpen(false);
      setForm(initialProductForm);
    } finally {
      setSavingNewProduct(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Productos"
        description="Modelo, variante, materiales y precios son editables."
        actions={
          <button type="button" className="button-primary" onClick={openAddDialog}>
            <PlusIcon size={18} weight="bold" aria-hidden="true" />
            Agregar producto
          </button>
        }
      />
      <section className="catalog-summary-grid">
        <article className="panel exchange-card">
          <div className="summary-icon"><CalculatorIcon size={24} aria-hidden="true" /></div>
          <h2>Tipo de cambio ARG → UYU</h2>
          <div className="rate-input"><label htmlFor="exchange-rate">1 ARS equivale a</label><div><input id="exchange-rate" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} onBlur={() => onUpdateExchangeRate(Number(rate.replace(",", ".")))} /><strong className="rate-suffix">UYU</strong></div></div>
        </article>
        <article className="panel catalog-count-card"><h2>Catálogo activo</h2><strong>{data.products.length}</strong><p>variantes en {new Set(data.products.map((product) => product.model)).size} modelos</p></article>
      </section>
      <section className="panel table-panel">
        <div className="table-toolbar products-toolbar">
          <div className="search-field">
            <MagnifyingGlassIcon size={19} aria-hidden="true" />
            <label className="sr-only" htmlFor="product-search">Buscar producto</label>
            <input
              id="product-search"
              type="search"
              value={query}
              placeholder="Buscar modelo, variante o material"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="products-toolbar-filters">
            {hasActiveFilters && (
              <button
                type="button"
                className="button-quiet filter-clear-btn"
                onClick={clearFilters}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
        <div className="table-summary"><strong>{filtered.length} productos editables</strong></div>
        {filtered.length ? (
          <div className="responsive-table-wrap">
            <table className="data-table editable-table product-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>
                    <select
                      className="header-filter-select"
                      value={modelFilter}
                      onChange={(event) => setModelFilter(event.target.value)}
                    >
                      <option value="">Modelo</option>
                      {modelOptions.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </th>
                  <th>
                    <select
                      className="header-filter-select"
                      value={variantFilter}
                      onChange={(event) => setVariantFilter(event.target.value)}
                    >
                      <option value="">Variante</option>
                      {variantOptions.map((variant) => (
                        <option key={variant} value={variant}>{variant}</option>
                      ))}
                    </select>
                  </th>
                  <th>
                    <select
                      className="header-filter-select"
                      value={rimFilter}
                      onChange={(event) => setRimFilter(event.target.value)}
                    >
                      <option value="">Virola</option>
                      {rimOptions.map((rim) => (
                        <option key={rim} value={rim}>{rim}</option>
                      ))}
                    </select>
                  </th>
                  <th>
                    <select
                      className="header-filter-select"
                      value={leatherFilter}
                      onChange={(event) => setLeatherFilter(event.target.value)}
                    >
                      <option value="">Cuero</option>
                      {leatherOptions.map((leather) => (
                        <option key={leather} value={leather}>{leather}</option>
                      ))}
                    </select>
                  </th>
                  <th>Precio ARG</th>
                  <th>Precio UYU</th>
                </tr>
              </thead>
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

      {dialogOpen && (
        <div
          className="customer-dialog-layer"
          onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}
        >
          <dialog
            className="customer-dialog"
            open
            aria-modal="true"
            aria-labelledby="product-dialog-title"
            onCancel={closeDialog}
          >
            <form onSubmit={handleAddSubmit}>
              <header>
                <div>
                  <h2 id="product-dialog-title">Agregar producto</h2>
                  <p>Completá los datos para incorporar un nuevo producto al catálogo.</p>
                </div>
                <button type="button" className="icon-button" aria-label="Cerrar" onClick={closeDialog}>
                  <XIcon size={20} aria-hidden="true" />
                </button>
              </header>

              <div className="customer-dialog-fields">
                <label htmlFor="product-model">
                  Modelo
                  <input
                    id="product-model"
                    value={form.model}
                    onChange={(event) => setForm((curr) => ({ ...curr, model: event.target.value }))}
                    placeholder="Ej: Imperial, Camionero, Torpedo..."
                    autoFocus
                    required
                  />
                </label>
                <label htmlFor="product-variant">
                  Variante
                  <input
                    id="product-variant"
                    value={form.variant}
                    onChange={(event) => setForm((curr) => ({ ...curr, variant: event.target.value }))}
                    placeholder="Ej: Cincelado, Vaqueta..."
                    required
                  />
                </label>
                <label htmlFor="product-rim-type">
                  Tipo de Virola
                  <input
                    id="product-rim-type"
                    value={form.rimType}
                    onChange={(event) => setForm((curr) => ({ ...curr, rimType: event.target.value }))}
                    placeholder="Ej: Alpaca, Lisa, Cincelada..."
                  />
                </label>
                <label htmlFor="product-leather-type">
                  Tipo de Cuero
                  <input
                    id="product-leather-type"
                    value={form.leatherType}
                    onChange={(event) => setForm((curr) => ({ ...curr, leatherType: event.target.value }))}
                    placeholder="Ej: Vaqueta, Crudo..."
                  />
                </label>
                <label className="customer-field-wide" htmlFor="product-price-arg">
                  Precio ARG
                  <input
                    id="product-price-arg"
                    type="number"
                    min="0"
                    step="any"
                    value={form.priceArg}
                    onChange={(event) => setForm((curr) => ({ ...curr, priceArg: event.target.value }))}
                    placeholder="0"
                    required
                  />
                </label>
              </div>

              <footer>
                <button type="button" className="button-quiet" onClick={closeDialog}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button-primary"
                  disabled={savingNewProduct || !form.model.trim() || !form.variant.trim()}
                >
                  {savingNewProduct ? "Guardando…" : "Guardar producto"}
                </button>
              </footer>
            </form>
          </dialog>
        </div>
      )}
    </div>
  );
}
