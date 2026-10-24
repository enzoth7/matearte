import { Catalog } from "./commerce/Operations";
import { useState } from "react";
import { FinanceOverview } from "./FinanceOverview";
import type { PageProps } from "./pages";
import { type Product, type Row, money, paymentMoney, balance, orderName } from "./data";
import { collections } from "./collections";
import { catalogImageOptions, catalogStatusOptions, matchesCatalogImage, matchesCatalogStatus, type CatalogImageFilter, type CatalogStatusFilter } from "./catalogListFilters";
import { Card, Stats, Table, Badge, Modal, downloadCsv } from "./ui";
import { formatDate } from "./dateFormat";
import { FunnelX } from "@phosphor-icons/react";

export function CollectionPage({ s, path }: PageProps & { path: string }) {
  const config = collections[path];
  const rows = s.records[path] || [];
  return <>
    {!rows.length && <div className="data-note">Esta sección todavía no tiene una fuente de datos conectada.</div>}
    <Table rows={rows} searchText={(r) => Object.values(r).join(" ")} columns={config.fields.map((field) => ({
      label: field.label, render: (row: Row) => field.key === "estado" ? <Badge>{String(row[field.key] ?? "")}</Badge> : String(row[field.key] ?? "—"),
    }))} />
  </>;
}

const price = (product: Product, channel: "Local" | "Web" | "Mayorista") => product.availableChannels?.includes(channel) ? money(product.prices[channel]) : "—";
const primaryPrice = (product: Product) => price(product, product.availableChannels?.includes("Web") ? "Web" : product.availableChannels?.includes("Local") ? "Local" : "Mayorista");
function ProductThumbnail({ product }: { product: Product }) {
  return <div className="product-photo-frame">{product.imageUrl
    ? <img className="product-photo" src={product.imageUrl} alt="" loading="lazy" style={product.imageCrop ? { transform: `translate(${product.imageCrop.x}%, ${product.imageCrop.y}%) scale(${product.imageCrop.zoom})` } : undefined} />
    : <div className="product-photo-empty">Sin foto</div>}</div>;
}
const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-_]+/g, " ").toLocaleLowerCase().trim();
export function Products({ s, mode, notify, refresh, commerce }: PageProps & { mode: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const params = new URLSearchParams(location.search);
    return params.get("nuevo") === "1" ? "new" : params.get("producto");
  });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(() => new URLSearchParams(location.search).get("variante"));
  const [editorDirty, setEditorDirty] = useState(false);
  const [filter, setFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState<CatalogStatusFilter>("Todos");
  const [imageFilter, setImageFilter] = useState<CatalogImageFilter>("Todas");
  const [search, setSearch] = useState("");
  const [view, setView] = useState(() => new URLSearchParams(location.search).get("vista") === "lista" ? "Lista" : "Tarjetas");
  const [listOrder, setListOrder] = useState("sku-asc");
  const hasCatalogFilters = filter !== "Todos" || statusFilter !== "Todos" || imageFilter !== "Todas" || search.trim() !== "";
  const clearCatalogFilters = () => {
    setFilter("Todos");
    setStatusFilter("Todos");
    setImageFilter("Todas");
    setSearch("");
  };
  const sectionProducts = s.products.filter((product) => mode === "servicios" ? product.categoryCode === "servicios" : product.categoryCode !== "servicios");
  const searchTerms = normalizeSearch(search).split(/\s+/).filter(Boolean);
  const rows = sectionProducts.filter((product) => {
    if (filter !== "Todos" && product.family !== filter) return false;
    if (!matchesCatalogStatus(product, statusFilter) || !matchesCatalogImage(product, imageFilter)) return false;
    const haystack = normalizeSearch(`${product.name} ${product.sku} ${product.variant} ${product.family} ${product.rim} ${product.leather} ${product.searchText || ""}`);
    return searchTerms.every((term) => haystack.includes(term));
  });
  const activeRows = rows.filter((product) => product.active);
  const webRows = activeRows.filter((product) => product.published && product.availableChannels?.includes("Web") && product.prices.Web > 0 && !["sandbox", "regalos"].includes(product.categoryCode || ""));
  const sortedRows = [...rows].sort((a, b) => {
    const bySku = a.sku.localeCompare(b.sku, "es", { numeric: true });
    const byPrice = a.prices.Local - b.prices.Local || bySku;
    if (listOrder.startsWith("modificacion")) {
      const byDate = (a.updatedAt ? Date.parse(a.updatedAt) || 0 : 0) - (b.updatedAt ? Date.parse(b.updatedAt) || 0 : 0);
      return byDate * (listOrder.endsWith("desc") ? -1 : 1) || bySku;
    }
    return (listOrder.startsWith("precio") ? byPrice : bySku) * (listOrder.endsWith("desc") ? -1 : 1);
  });
  const activeCardId = selectedCardId || rows.find(product => (product.sourceProductId || product.id) === selectedId)?.id;
  const selectProduct = (next: string | null, cardId: string | null = null) => {
    if (selectedId === next && selectedCardId === cardId) return;
    if (selectedId !== next && editorDirty && !window.confirm("Hay cambios sin guardar. ¿Querés salir de esta ficha?")) return;
    if (selectedId !== next) setEditorDirty(false);
    setSelectedId(next);
    setSelectedCardId(cardId);
    history.pushState(null, "", `${location.pathname}${next === "new" ? "?nuevo=1" : next ? `?producto=${encodeURIComponent(next)}${cardId ? `&variante=${encodeURIComponent(cardId)}` : ""}` : ""}`);
    if (selectedId !== next) {
      if (!next) void refresh?.();
      else if (mode === "catalogo") requestAnimationFrame(() => document.querySelector(".catalog-split-view")?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
    }
  };
  const legacyProduct = selectedId?.startsWith("wholesale:") ? commerce?.wholesale?.products.find(entry => `wholesale:${entry.id}` === selectedId) : undefined;
  const resolvedSelectedId = legacyProduct?.commerce_product_id || selectedId;
  const editor = selectedId && <div className="commerce-tools catalog-editor"><Catalog onNotice={notify} embedded={mode === "catalogo" || mode === "servicios"} fixedCategory={mode === "servicios" ? "servicios" : undefined} initialProductId={resolvedSelectedId === "new" ? undefined : resolvedSelectedId || undefined} initialVariantId={selectedCardId} startNew={selectedId === "new"} onDirtyChange={setEditorDirty} onCancelNew={() => selectProduct(null)} onClose={() => selectProduct(null)} onCatalogChange={refresh} onCreated={(id) => { setEditorDirty(false); setSelectedId(id); history.replaceState(null, "", `${location.pathname}?producto=${encodeURIComponent(id)}`); void refresh?.(); }} /></div>;
  if (selectedId && mode !== "catalogo") return <><div className="toolbar"><button className="secondary" onClick={() => selectProduct(null)}>Volver al catálogo</button></div>{editor}</>;
  return <>
    {!selectedId && <Stats items={[
      { label: mode === "servicios" ? "Servicios visibles" : "Artículos visibles", value: rows.length, help: mode === "servicios" ? "Servicios que aparecen en esta lista después de aplicar los filtros y la búsqueda." : "Variantes que aparecen como tarjetas o filas después de aplicar los filtros y la búsqueda. Incluye artículos activos e inactivos." },
      { label: mode === "servicios" ? "Con precio definido" : "Disponibles en web", value: mode === "servicios" ? rows.filter((product) => product.prices.Local > 0).length : webRows.length, help: mode === "servicios" ? "Servicios visibles que tienen un precio fijo cargado." : "Variantes visibles que pueden venderse en la web: están activas, el producto está publicado, tienen habilitado el canal Web y un precio web mayor a cero." },
      { label: mode === "servicios" ? "Servicios activos" : "Artículos activos", value: activeRows.length, help: mode === "servicios" ? "Servicios visibles marcados como activos." : "Variantes visibles marcadas como activas. Pueden no estar publicadas en la web." },
    ]} />}
    <div className={`toolbar ${selectedId ? "catalog-toolbar-open" : ""}`}>
      {!selectedId && <div className="table-actions"><button className="primary" onClick={() => selectProduct("new")}>Nuevo producto</button></div>}
      <div className="table-actions">
        <label className="inline-label">Familia<select value={filter} onChange={(e) => setFilter(e.target.value)}>{["Todos", ...new Set(sectionProducts.map((p) => p.family))].map((family) => <option key={family}>{family}</option>)}</select></label>
        <label className="inline-label">Estado<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CatalogStatusFilter)}>{catalogStatusOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label className="inline-label">Imagen<select value={imageFilter} onChange={(e) => setImageFilter(e.target.value as CatalogImageFilter)}>{catalogImageOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        {mode === "catalogo" && !selectedId && <label className="inline-label catalog-sort">Ordenar<select aria-label="Ordenar catálogo" value={listOrder} onChange={(event) => setListOrder(event.target.value)}><option value="sku-asc">SKU ascendente</option><option value="sku-desc">SKU descendente</option><option value="precio-asc">Precio local ascendente</option><option value="precio-desc">Precio local descendente</option><option value="modificacion-desc">Última modificación: más nueva</option><option value="modificacion-asc">Última modificación: más vieja</option></select></label>}
        {mode === "catalogo" && <button type="button" className="catalog-clear-filters" aria-label="Quitar filtros" title="Quitar filtros y búsqueda" onClick={clearCatalogFilters} disabled={!hasCatalogFilters}><FunnelX size={20} aria-hidden="true" /></button>}
        {mode === "catalogo" && !selectedId && <div className="tabs">{["Tarjetas", "Lista"].map((item) => <button key={item} className={item === view ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}</div>}
      </div>
      <input aria-label="Buscar productos" placeholder="Buscar por nombre, SKU, material o característica" value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>
    {mode === "catalogo" && selectedId && <div className="catalog-split-view"><aside className="catalog-product-rail" aria-label="Productos del catálogo"><div className="catalog-rail-heading"><strong>Productos</strong><small>{rows.length} artículos</small></div><div className="product-grid catalog-rail-grid">{sortedRows.map((product) => <button className={`product-card ${activeCardId === product.id ? "selected" : ""}`} key={product.id} onClick={() => selectProduct(product.wholesaleProductId ? product.id : product.sourceProductId || product.id, product.id)} aria-pressed={activeCardId === product.id}>
      <ProductThumbnail product={product} />
      <div className="product-info">{!product.wholesaleProductId && product.variant !== "Sin color" && <small>{product.variant}</small>}<h3>{product.name}</h3><div><strong>{primaryPrice(product)}</strong></div></div>
    </button>)}</div>{!rows.length && <div className="empty">No hay productos con este filtro.</div>}</aside><div className="catalog-editor-column">{editor}</div></div>}
    {mode === "catalogo" && !selectedId && view === "Tarjetas" ? <div className="product-grid">{sortedRows.map((product) => <button className="product-card" key={product.id} onClick={() => selectProduct(product.wholesaleProductId ? product.id : product.sourceProductId || product.id, product.id)}>
      <ProductThumbnail product={product} />
      <div className="product-info">{!product.wholesaleProductId && product.variant !== "Sin color" && <small>{product.variant}</small>}<h3>{product.name}</h3><div><strong>{primaryPrice(product)}</strong></div></div>
    </button>)}</div> : !selectedId && <section className="catalog-general-list">
      <header className="catalog-print-heading"><strong>MateArte</strong><div>Catálogo de productos · {formatDate(new Date())}</div></header>
      <Table rows={sortedRows} searchText={(p) => `${p.name} ${p.sku} ${p.variant} ${p.family}`} showSearch={false} action={<>{mode === "servicios" && <label className="catalog-sort">Ordenar<select value={listOrder} onChange={(event) => setListOrder(event.target.value)}><option value="sku-asc">SKU ascendente</option><option value="sku-desc">SKU descendente</option><option value="precio-asc">Precio local ascendente</option><option value="precio-desc">Precio local descendente</option></select></label>}<button className="secondary catalog-print-button" onClick={() => window.print()}>Imprimir lista</button></>} columns={mode === "servicios" ? [
      { label: "SKU", render: (p) => p.sku || "—" },
      { label: "Servicio", render: (p) => <button className="text-button" onClick={() => selectProduct(p.sourceProductId || p.id, p.id)}>{p.name}</button> },
      { label: "Precio local", render: (p) => p.prices.Local > 0 ? money(p.prices.Local) : "A definir en la venta" },
      ] : [
      { label: "SKU", render: (p) => p.sku || "—" },
      { label: "Producto", render: (p) => <button className="text-button" onClick={() => selectProduct(p.wholesaleProductId ? p.id : p.sourceProductId || p.id, p.id)}>{p.name}</button> },
      { label: "Variante", render: (p) => p.wholesaleProductId ? "—" : p.variant },
      { label: "Categoría", render: (p) => p.family },
      { label: "Precio Base", render: (p) => p.basePrice == null ? "—" : money(p.basePrice) },
      { label: "Local", render: (p) => price(p, "Local") },
      { label: "Web", headerClassName: "channel-web-text", render: (p) => price(p, "Web") },
      { label: "Mayorista", render: (p) => price(p, "Mayorista") },
      { label: "ARS", render: (p) => p.availableChannels?.includes("Mayorista") && p.priceArg ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(p.priceArg) : "—" },
      ]} />
      {mode !== "servicios" && s.products.find((p) => p.wholesaleThreshold) && <div className="catalog-wholesale-note">Mayorista desde {s.products.find((p) => p.wholesaleThreshold)?.wholesaleThreshold} artículos.</div>}
    </section>}

  </>;
}
export function Inventory(_props: PageProps & { mode: string }) {
  return <Card title="Inventario"><div>Commerce Admin no registra existencias físicas ni movimientos de stock. Esta sección se completará al conectar el sistema de inventario.</div></Card>;
}
export function Finance({ s, go, mode }: PageProps & { mode: string }) {
  if (mode === "resumen") return <FinanceOverview s={s} />;
  if (mode === "monedas") return <Table rows={s.records.monedas || []} searchText={(row) => String(row.moneda)} columns={[
    { label: "Moneda", render: (row) => String(row.moneda) },
    { label: "Equivalencia en UYU", render: (row) => Number(row.valor).toLocaleString("es-UY", { maximumFractionDigits: 4 }) },
  ]} />;
  if (mode === "cobros") return <>
    <Stats items={[
      { label: "Cobros y señas", value: money(s.payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0)), tone: "green" },
      { label: "Pendiente de cobro", value: money(s.orders.reduce((sum, order) => sum + balance(s, order), 0)), go: () => go("/finanzas/por-cobrar") },
    ]} />
    {s.payments.some((payment) => payment.reconciliationRequired) && <div className="data-note">Hay cobros pendientes de conciliación. Los importes sin equivalencia histórica se muestran abajo y no se incluyen en el total UYU.</div>}
    <Table rows={s.payments} action={<button className="secondary" onClick={() => downloadCsv("cobros", s.payments.map((payment) => ({
      Pedido: orderName(s.orders.find((order) => order.id === payment.orderId)!), Fecha: payment.date, Medio: payment.method,
      Moneda: payment.sourceCurrency || "UYU", "Importe original": payment.sourceAmount ?? payment.amount,
      "Equivalente histórico UYU": payment.amount, Conciliación: payment.reconciliationRequired ? "Pendiente" : "Conciliado",
    })))}>Exportar cobros</button>} searchText={(payment) => `${payment.orderId} ${payment.method}`} columns={[
      { label: "Pedido", render: (payment) => <button className="text-button" onClick={() => go(`/comercial/pedidos?pedido=${payment.orderId}`)}>{orderName(s.orders.find((order) => order.id === payment.orderId)!)}</button> },
      { label: "Fecha", render: (payment) => formatDate(payment.date) },
      { label: "Medio", render: (payment) => payment.method },
      { label: "Importe", render: (payment) => paymentMoney(payment) },
      { label: "Referencia de pago", render: (payment) => payment.derived ? "Según estado de producción" : payment.id },
    ]} />
  </>;
  return <>{!s.expensesConnected && <div className="data-note">Los egresos todavía no tienen una fuente conectada.</div>}{s.expensesConnected && <div className="data-note">Egresos cargados en Inventario y compras → Compras y Gastos fijos. Para agregar o corregir uno, hacelo allá.</div>}<Table rows={s.expenses} searchText={(e) => `${e.name} ${e.category}`} columns={[
    { label: "Concepto", render: (e) => e.name }, { label: "Categoría", render: (e) => e.category ? <Badge>{e.category}</Badge> : "—" }, { label: "Fecha", render: (e) => formatDate(e.date) },
    { label: "Estado", render: (e) => <Badge tone={e.paid ? "green" : "yellow"}>{e.paid ? "Pagado" : "Por pagar"}</Badge> }, { label: "Importe", render: (e) => money(e.amount) },
  ]} /></>;
}
