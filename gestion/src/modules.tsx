import { Catalog } from "./commerce/Operations";
import { WholesaleProductEditor } from "./WholesaleScreens";
import { useState } from "react";
import { FinanceOverview } from "./FinanceOverview";
import type { PageProps } from "./pages";
import { type Product, type Row, money, balance, orderName } from "./data";
import { collections } from "./collections";
import { Card, Stats, Table, Badge, Modal } from "./ui";

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
function ProductThumbnail({ product }: { product: Product }) {
  return <div className="product-photo-frame">{product.imageUrl
    ? <img className="product-photo" src={product.imageUrl} alt="" loading="lazy" style={product.imageCrop ? { transform: `translate(${product.imageCrop.x}%, ${product.imageCrop.y}%) scale(${product.imageCrop.zoom})` } : undefined} />
    : <div className="product-photo-empty">Sin foto</div>}</div>;
}
export function Products({ s, mode, notify, refresh, commerce }: PageProps & { mode: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const params = new URLSearchParams(location.search);
    return params.get("nuevo") === "1" ? "new" : params.get("producto");
  });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(() => new URLSearchParams(location.search).get("variante"));
  const [editorDirty, setEditorDirty] = useState(false);
  const [filter, setFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [view, setView] = useState(() => new URLSearchParams(location.search).get("vista") === "lista" ? "Lista" : "Tarjetas");
  const [listOrder, setListOrder] = useState("sku-asc");
  const rows = s.products.filter((product) => (filter === "Todos" || product.family === filter) && `${product.name} ${product.sku} ${product.variant}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const listRows = [...rows].sort((a, b) => {
    const bySku = a.sku.localeCompare(b.sku, "es", { numeric: true });
    const byPrice = a.prices.Local - b.prices.Local || bySku;
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
  const wholesaleSelection = selectedId === "wholesale-new" || selectedId?.startsWith("wholesale:");
  const editor = selectedId && <div className="commerce-tools catalog-editor">{wholesaleSelection && commerce?.wholesale ? <WholesaleProductEditor key={selectedId} product={commerce.wholesale.products.find((entry) => `wholesale:${entry.id}` === selectedId)} snapshot={commerce.wholesale} onSaved={() => { notify("Producto mayorista guardado"); selectProduct(null); void refresh?.(); }} onClose={() => selectProduct(null)} /> : <Catalog onNotice={notify} embedded={mode === "catalogo"} initialProductId={selectedId === "new" ? undefined : selectedId} startNew={selectedId === "new"} onDirtyChange={setEditorDirty} onCancelNew={() => selectProduct(null)} onClose={() => selectProduct(null)} onCatalogChange={refresh} onCreated={(id) => { setEditorDirty(false); setSelectedId(id); history.replaceState(null, "", `${location.pathname}?producto=${encodeURIComponent(id)}`); void refresh?.(); }} />}</div>;
  if (selectedId && mode !== "catalogo") return <><div className="toolbar"><button className="secondary" onClick={() => selectProduct(null)}>Volver al catálogo</button></div>{editor}</>;
  return <>
    {!selectedId && <Stats items={[
      { label: "Productos en catálogo", value: new Set(s.products.map((p) => p.sourceProductId || p.id)).size },
      { label: "Publicados en web", value: new Set(s.products.filter((p) => p.published).map((p) => p.sourceProductId || p.id)).size },
      { label: "Variantes activas", value: s.products.filter((p) => p.active).length },
    ]} />}
    <div className={`toolbar ${selectedId ? "catalog-toolbar-open" : ""}`}>
      {!selectedId && <div className="table-actions"><button className="primary" onClick={() => selectProduct("new")}>Nuevo producto web</button><button className="secondary" onClick={() => selectProduct("wholesale-new")}>Nuevo mayorista</button></div>}
      <div className="table-actions">
        <label className="inline-label">Familia<select value={filter} onChange={(e) => setFilter(e.target.value)}>{["Todos", ...new Set(s.products.map((p) => p.family))].map((family) => <option key={family}>{family}</option>)}</select></label>
        {mode === "catalogo" && !selectedId && <div className="tabs">{["Tarjetas", "Lista"].map((item) => <button key={item} className={item === view ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}</div>}
      </div>
      <input aria-label="Buscar productos" placeholder="Buscar producto, variante o SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>
    {mode === "catalogo" && selectedId && <div className="catalog-split-view"><aside className="catalog-product-rail" aria-label="Productos del catálogo"><div className="catalog-rail-heading"><strong>Productos</strong><small>{rows.length} variantes</small></div><div className="product-grid catalog-rail-grid">{rows.map((product) => <button className={`product-card ${activeCardId === product.id ? "selected" : ""}`} key={product.id} onClick={() => selectProduct(product.wholesaleProductId ? product.id : product.sourceProductId || product.id, product.id)} aria-pressed={activeCardId === product.id}>
      <ProductThumbnail product={product} />
      <div className="product-info"><small>{product.variant}</small><h3>{product.name}</h3><div><strong>{price(product, product.wholesaleProductId ? "Mayorista" : "Web")}</strong><Badge>{product.wholesaleProductId ? "Mayorista" : product.published ? "Publicado" : "Oculto"}</Badge></div></div>
    </button>)}</div>{!rows.length && <div className="empty">No hay productos con este filtro.</div>}</aside><div className="catalog-editor-column">{editor}</div></div>}
    {mode === "catalogo" && !selectedId && view === "Tarjetas" ? <div className="product-grid">{rows.map((product) => <button className="product-card" key={product.id} onClick={() => selectProduct(product.wholesaleProductId ? product.id : product.sourceProductId || product.id, product.id)}>
      <ProductThumbnail product={product} />
      <div className="product-info"><small>{product.variant}</small><h3>{product.name}</h3><div><strong>{price(product, product.wholesaleProductId ? "Mayorista" : "Web")}</strong><Badge>{product.wholesaleProductId ? "Mayorista" : product.published ? "Publicado" : "Oculto"}</Badge></div></div>
    </button>)}</div> : !selectedId && <section className="catalog-general-list">
      <header className="catalog-print-heading"><strong>MateArte</strong><div>Catálogo de productos · {new Date().toLocaleDateString("es-UY")}</div></header>
      <Table rows={listRows} searchText={(p) => `${p.name} ${p.sku} ${p.variant} ${p.family}`} showSearch={false} action={<><label className="catalog-sort">Ordenar<select value={listOrder} onChange={(event) => setListOrder(event.target.value)}><option value="sku-asc">SKU ascendente</option><option value="sku-desc">SKU descendente</option><option value="precio-asc">Precio local ascendente</option><option value="precio-desc">Precio local descendente</option></select></label><button className="secondary catalog-print-button" onClick={() => window.print()}>Imprimir lista</button></>} columns={[
      { label: "SKU", render: (p) => p.sku || "—" },
      { label: "Producto", render: (p) => <button className="text-button" onClick={() => selectProduct(p.wholesaleProductId ? p.id : p.sourceProductId || p.id, p.id)}>{p.name}</button> },
      { label: "Variante", render: (p) => p.variant },
      { label: "Categoría", render: (p) => p.family },
      { label: "Local", render: (p) => price(p, "Local") },
      { label: "Web", headerClassName: "channel-web-text", render: (p) => price(p, "Web") },
      { label: "Mayorista", render: (p) => price(p, "Mayorista") },
      { label: "ARS", render: (p) => p.wholesaleProductId ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(p.priceArg || 0) : "—" },
      { label: "Publicado", render: (p) => <Badge>{p.wholesaleProductId ? "Mayorista" : p.published ? "Publicado" : "Oculto"}</Badge> },
      ]} />
      {s.products.find((p) => p.wholesaleThreshold) && <div className="catalog-wholesale-note">Mayorista desde {s.products.find((p) => p.wholesaleThreshold)?.wholesaleThreshold} mates.</div>}
    </section>}

  </>;
}
export function Pricing(_props: PageProps) {
  return <Card title="Precios del personalizador"><div>La conexión con el administrador del visualizador todavía está pendiente.</div></Card>;
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
      { label: "Cobros y señas", value: money(s.payments.reduce((sum, payment) => sum + payment.amount, 0)), tone: "green" },
      { label: "Pendiente de cobro", value: money(s.orders.reduce((sum, order) => sum + balance(s, order), 0)), go: () => go("/finanzas/por-cobrar") },
    ]} />
    <Table rows={s.payments} searchText={(payment) => `${payment.orderId} ${payment.method}`} columns={[
      { label: "Pedido", render: (payment) => <button className="text-button" onClick={() => go(`/comercial/pedidos?pedido=${payment.orderId}`)}>{orderName(s.orders.find((order) => order.id === payment.orderId)!)}</button> },
      { label: "Fecha", render: (payment) => payment.date },
      { label: "Medio", render: (payment) => payment.method },
      { label: "Importe", render: (payment) => money(payment.amount) },
      { label: "Referencia de pago", render: (payment) => payment.derived ? "Según estado de producción" : payment.id },
    ]} />
  </>;
  return <><div className="data-note">Los egresos todavía no tienen una fuente conectada.</div><Table rows={s.expenses} searchText={(e) => e.name} columns={[
    { label: "Concepto", render: (e) => e.name }, { label: "Fecha", render: (e) => e.date }, { label: "Importe", render: (e) => money(e.amount) },
  ]} /></>;
}
