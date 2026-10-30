import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowDown, ArrowUp, CaretDown, Check, Eye, Funnel, FunnelX, MagnifyingGlass, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import type { PageProps } from "./pages";
import type { Customer, Order, Product } from "./data";
import { money, orderName, paid, balance, total } from "./data";
import { Badge, Modal, Stats, Table, type Column } from "./ui";
import { discountSummary, formatPercent, orderDiscountPercent, parseDiscountPercent } from "./wholesaleDiscount";
import { createWholesaleOrder, setWholesaleOrderDiscount, deleteWholesaleCustomer, countWholesaleCustomerLines, deleteWholesaleLine, completeWholesaleLine, saveWholesaleCustomer, updateWholesaleLine, wholesaleProductImageUrl, type WholesaleCustomer, type WholesaleLine, type WholesaleProduct, type WholesaleProductImage, type WholesaleSnapshot } from "./wholesaleSource";
import { ProductCoverEditor, type ProductCoverCrop } from "./commerce/ProductCoverEditor";
import { exportWholesaleCsv, exportWholesalePdf, exportWholesaleViewCsv, exportWholesaleViewPdf, exportWholesaleViewXlsx, exportWholesaleXlsx, type WholesaleCurrency, type WholesaleViewTable } from "./wholesaleExports";
import { exportWholesaleOrderPdf, type WholesaleOrderPdfKind } from "./wholesaleOrderPdf";
import { summarizeWholesale, wholesaleLineValue } from "./wholesaleAdapter";
import { formatContactName } from "../../shared/contactName";
import { CustomerFormFields, readCustomerForm } from "./CustomerFormFields";
import { CatalogVariantDetails } from "./CatalogVariantDetails";
import { isMateCategory, mateLeatherCode, mateRimCode } from "./mateOptions";
import { CatalogProductCoreFields } from "./CatalogProductCoreFields";
import { DynamicAttributeFields } from "./commerce/Operations";
import { loadCatalogTaxonomy } from "./commerce/catalogTaxonomy";
import { catalogValueLabel, allowsFlejeDesign, defaultCatalogTaxonomy, normalizeCatalogValueMap, taxonomyOptionsFor, type CatalogMaterialId, type CatalogTaxonomy } from "../../shared/catalog-taxonomy";
import { naturalCaseName } from "./productionPresentation";
import { GENERIC_WHOLESALE_VARIANT, genericVariantPriceConflict, wholesaleSaleCategory, wholesaleSaleCategoryLabel, wholesaleSaleType, wholesaleSaleVariantLabel } from "./wholesaleSaleSelection";
import { formatDate } from "./dateFormat";
import { matchesSaleProductSearch } from "./saleProductSearch";
import { useOrderDraft } from "./orderDraft";
import { OrderDraftList } from "./OrderDraftList";

const formatArg = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
const saleArg = (value: number) => `ARS ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}`;
const wholesaleMoney = (value: number, currency: WholesaleCurrency) => `${currency} ${new Intl.NumberFormat("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)}`;
const normalizeWholesaleText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
const wholesaleProductKey = (model: string, variant: string) => `${normalizeWholesaleText(model)}\u0000${normalizeWholesaleText(variant)}`;
const wholesaleStatusTone = (status: string) => status === "Completado" ? "green" as const : status === "En producción" ? "blue" as const : undefined;
const errorText = (value: unknown) => value instanceof Error ? value.message : "No se pudo guardar. Volvé a intentar.";
const snapshotOf = (props: PageProps) => props.commerce?.wholesale;
const productLabel = (product: WholesaleProduct) => `${product.model} · ${product.variant}`;
const mateModelCode = (model: string, category: string | null | undefined) => category === "mates" && ["imperial", "camionero", "criollo", "torpedo"].includes(model.trim().toLocaleLowerCase("es")) ? model.trim().toLocaleLowerCase("es") : "";

const saleGroup = (product: WholesaleProduct) => { const category = wholesaleSaleCategory(product); return category === "bombillones" ? "bombillas" : category; };
const customerLabel = (entry: WholesaleCustomer) => [formatContactName(entry.full_name), entry.company_name?.trim()].filter(Boolean).join(" · ");
const NEW_ITEM = () => ({ key: crypto.randomUUID(), category: "", model: "", name: "", productId: "", quantity: 1, noCost: false, generic: false });
type WholesaleSaleDraft = { customer: string; items: ReturnType<typeof NEW_ITEM>[]; applyDiscount: boolean; discountText: string };

export function WholesaleSummary({ props }: { props: PageProps }) {
  const snapshot = snapshotOf(props);
  if (!snapshot) return <div className="empty">Cargando resumen mayorista…</div>;
  const summary = summarizeWholesale(snapshot);
  const statusRows = [
    { id: "pending", label: "Pendientes", units: summary.pendingUnits, className: "is-pending" },
    { id: "progress", label: "En producción", units: summary.inProductionUnits, className: "is-progress" },
  ];
  const maxStatus = Math.max(1, ...statusRows.map((row) => row.units));
  const maxClient = Math.max(1, ...summary.clientStats.map(([, units]) => units));

  return <section className="wholesale-summary" aria-labelledby="wholesale-summary-title">
    <div className="wholesale-summary-heading">
      <div><h2 id="wholesale-summary-title">Resumen mayorista</h2><p>Estado actual de los pedidos y la producción mayorista.</p></div>
      <div className="wholesale-summary-values" aria-label="Valores activos mayoristas">
        <div><small>Valor activo UYU</small><strong>{money(summary.activeValueUyu)}</strong></div>
        <div><small>Valor activo ARS</small><strong>{formatArg(summary.activeValueArg)}</strong></div>
      </div>
    </div>
    <Stats items={[
      { label: "Unidades activas", value: summary.activeUnits },
      { label: "Pendientes", value: summary.pendingUnits },
      { label: "En producción", value: summary.inProductionUnits },
      { label: "Clientes activos", value: summary.activeCustomers },
    ]} />
    <div className="wholesale-summary-charts">
      <section className="card wholesale-status-chart" aria-labelledby="wholesale-status-title">
        <div className="card-heading"><div><h2 id="wholesale-status-title">Carga por estado</h2></div><strong>{summary.activeUnits} u.</strong></div>
        <div className="wholesale-bars">
          {statusRows.map((row) => <div className="wholesale-bar-row" key={row.id}>
            <span>{row.label}</span><div><i className={row.className} style={{ width: `${Math.max(row.units ? 8 : 0, row.units / maxStatus * 100)}%` }} /></div><strong>{row.units} u.</strong>
          </div>)}
        </div>
      </section>
      <section className="card wholesale-client-chart" aria-labelledby="wholesale-client-title">
        <div className="card-heading"><div><h2 id="wholesale-client-title">Unidades por cliente</h2></div></div>
        {summary.clientStats.length ? <ol>
          {summary.clientStats.map(([customer, units], index) => <li key={customer}>
            <b>{String(index + 1).padStart(2, "0")}</b><span title={naturalCaseName(formatContactName(customer))}>{naturalCaseName(formatContactName(customer))}</span><progress max={maxClient} value={units} aria-label={`${naturalCaseName(formatContactName(customer))}: ${units} unidades`} /><strong>{units} u.</strong>
          </li>)}
        </ol> : <div className="empty">No hay producción mayorista activa.</div>}
      </section>
    </div>
  </section>;
}

export function WholesaleRegister(props: PageProps) {
  const snapshot = snapshotOf(props);
  const [customer, setCustomer] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const saleChannel: NonNullable<WholesaleLine["sale_channel"]> = "WhatsApp";
  const [items, setItems] = useState([NEW_ITEM()]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountText, setDiscountText] = useState("10");
  const [draftNotice, setDraftNotice] = useState("");
  const draftHasContent = Boolean(customer || items.some(item => item.productId || item.category || item.model || item.name || item.noCost || item.quantity !== 1) || applyDiscount || discountText !== "10");
  const draft = useOrderDraft(`mayorista:${props.session?.user.id || props.s.activeUserId || props.s.user}`,
    { customer, items, applyDiscount, discountText } satisfies WholesaleSaleDraft,
    draftHasContent,
    (saved, isNew) => { setCustomer(saved.customer); setItems(saved.items); setApplyDiscount(saved.applyDiscount); setDiscountText(saved.discountText); setDraftNotice(isNew ? "Nuevo pedido iniciado. Podés volver a los otros borradores cuando quieras." : "Borrador retomado. Revisá precios y disponibilidad antes de crear el pedido."); });
  if (!snapshot) return <div className="empty">Cargando producción mayorista…</div>;
  const sortedProducts = snapshot.products.filter(product => product.available_wholesale !== false && saleGroup(product)).sort((a, b) => productLabel(a).localeCompare(productLabel(b), "es"));
  const productMatches = productSearch.trim() ? sortedProducts.filter((product) => matchesSaleProductSearch({
    name: product.model, sku: product.sku, variant: product.variant, category: wholesaleSaleCategoryLabel(wholesaleSaleCategory(product)!),
    description: product.description, material: product.leather_type, rim: product.rim_type,
    attributes: product.catalog_attributes, price: Number(product.price_arg) || 0,
  }, productSearch)).slice(0, 50) : [];
  const sortedCustomers = [...snapshot.customers].sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
  const customerMatches = sortedCustomers.filter((entry) => `${entry.full_name} ${entry.company_name || ""}`.toLocaleLowerCase("es").includes(customerSearch.trim().toLocaleLowerCase("es")));
  const visibleCustomers = sortedCustomers.filter((entry) => !customerSearch.trim() || customerMatches.includes(entry) || entry.full_name === customer);
  const estimated = items.reduce((sum, item) => sum + (item.noCost ? 0 : Number(snapshot.products.find((product) => String(product.id) === item.productId)?.price_arg || 0) * item.quantity), 0);
  const discountPercent = applyDiscount ? Math.min(100, Math.max(0, Number(discountText) || 0)) : 0;
  const discounted = Math.round(estimated * (1 - discountPercent / 100) * 100) / 100;
  function chooseProduct(product: WholesaleProduct) {
    const picked = { category: saleGroup(product) || "", model: wholesaleSaleType(product), name: product.model, productId: String(product.id), generic: false };
    const target = items.find((row) => !row.productId);
    const key = target?.key ?? crypto.randomUUID();
    setItems((current) => target ? current.map((row) => row.key === target.key ? { ...row, ...picked } : row) : [...current, { ...NEW_ITEM(), key, ...picked }]);
    setProductSearch("");
  }
  function patchItem(key: string, patch: Partial<ReturnType<typeof NEW_ITEM>>) {
    setItems((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }
  const imageOf = (product?: WholesaleProduct) => { const path = product && snapshot.images.find((image) => image.product_id === String(product.id))?.storage_path; return path ? wholesaleProductImageUrl(path) : ""; };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      if (!items.length || !items.every((item) => item.productId && Number.isInteger(item.quantity) && item.quantity > 0)) throw new Error("Revisá productos y cantidades.");
      if (applyDiscount && !(discountPercent > 0)) throw new Error("Ingresá un descuento mayor a 0%, o elegí \"No\".");
      const orderId = await createWholesaleOrder(customer, items, saleChannel, discountPercent);
      await draft.finish().catch(() => undefined);
      await props.refresh?.(); props.notify(`Pedido ${orderId} creado.`);
      props.go(`/comercial/pedidos?pedido=${encodeURIComponent(`wholesale:${orderId}`)}`);
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  const photoLines = items.map((item) => ({ item, product: snapshot.products.find((product) => String(product.id) === item.productId) })).filter((entry): entry is { item: typeof items[number]; product: WholesaleProduct } => !!entry.product);
  const draftPanel = <div className="order-draft-panel" aria-live="polite">
    {draft.status === "loading" ? <span>Buscando borradores…</span> : draft.status === "available" ? <OrderDraftList drafts={draft.saved} title="Borradores de pedidos mayoristas" newLabel="Empezar un pedido nuevo" describe={saved => `${saved.customer || "Sin cliente"} · ${saved.items.filter(item => item.productId).length} ${saved.items.filter(item => item.productId).length === 1 ? "artículo" : "artículos"}`} onResume={draft.resume} onNew={draft.startNew} onDiscard={id => void draft.discard(id)} /> : <><strong>{draft.error ? "Borrador automático no disponible" : draftNotice || "Borrador automático activo"}</strong><span>Los cambios se guardan en este navegador mientras preparás el pedido.</span><div><button type="button" className="secondary" disabled={!draftHasContent} onClick={() => void draft.saveNow().then(ok => setDraftNotice(ok ? "Borrador guardado en este navegador." : "No se pudo guardar el borrador."))}>Guardar borrador</button><button type="button" className="secondary" onClick={() => void draft.showList()}>Ver mis borradores</button></div></>}
    {draft.error && <span className="error" role="alert">{draft.error}</span>}
  </div>;
  if (draft.status === "loading" || draft.status === "available") return <div className="order-draft-gate">{draftPanel}</div>;
  return <>
  <form className="wholesale-sale-register" onSubmit={(event) => void submit(event)}>
    <div className="wholesale-sale-main">
    {draftPanel}
    <section className="local-sale-section wholesale-sale-section">
      <div className="wholesale-sale-section-heading">
        <div><h2>Artículos</h2><p>Seleccioná cada artículo y la cantidad solicitada.</p></div>
        <button type="button" className="primary" onClick={() => setItems((current) => [...current, NEW_ITEM()])}><Plus size={18} aria-hidden="true" />Agregar artículo</button>
      </div>
      <div className="wholesale-sale-product-search"><label>Buscar producto<span><MagnifyingGlass size={18} aria-hidden="true" /><input type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Nombre, código, precio o material" /></span></label>
        {productSearch.trim() && <div className="wholesale-sale-search-results" aria-label="Resultados de productos">{productMatches.map((product) => <button type="button" key={product.id} onClick={() => chooseProduct(product)}><span>{wholesaleSaleVariantLabel(product)}<small>{wholesaleSaleCategoryLabel(wholesaleSaleCategory(product)!)}{product.sku ? ` · SKU ${product.sku}` : ""}</small></span><strong>{saleArg(Number(product.price_arg) || 0)}</strong></button>)}{!productMatches.length && <div className="wholesale-sale-no-results">No hay productos mayoristas con esa búsqueda.</div>}</div>}
      </div>
      {items.length ? <div className="wholesale-sale-lines"><div className="wholesale-sale-line-head" aria-hidden="true"><span>Categoría</span><span>Tipo</span><span>Nombre</span><span>Variante</span><span>Cantidad</span><span>Importe ARS</span><span>Sin costo</span><span></span></div>{items.map((item, index) => {
        const selectedProduct = snapshot.products.find((product) => String(product.id) === item.productId);
        const lineTotal = item.noCost ? 0 : Number(selectedProduct?.price_arg || 0) * item.quantity;
        const inCategory = sortedProducts.filter((product) => saleGroup(product) === item.category);
        const models = [...new Set(inCategory.map(wholesaleSaleType))].sort((a, b) => a.localeCompare(b, "es"));
        const inType = inCategory.filter((product) => wholesaleSaleType(product) === item.model);
        const names = [...new Set(inType.map((product) => product.model.trim()))].sort((a, b) => a.localeCompare(b, "es"));
        const variants = inType.filter((product) => product.model.trim() === item.name);
        const genericOk = variants.length > 1 && !genericVariantPriceConflict(variants);
        const typeLabel = item.category === "mates" ? "Modelo de mate" : item.category === "materas" ? "Forma" : item.category === "bombillas" ? "Tipo de bombilla" : "Tipo";
        return <div className="wholesale-sale-line" key={item.key}>
          <label className="wholesale-sale-cell"><span>Categoría</span><select required aria-label={`Categoría ${index + 1}`} value={item.category} onChange={(event) => patchItem(item.key, { category: event.target.value, model: "", name: "", productId: "", generic: false })}><option value="">Elegir</option><option value="mates">Mates</option><option value="materas">Materas</option><option value="bombillas">Bombillas</option></select></label>
          <label className="wholesale-sale-cell"><span>{typeLabel}</span><select required aria-label={`Tipo ${index + 1}`} value={item.model} disabled={!item.category} onChange={(event) => patchItem(item.key, { model: event.target.value, name: "", productId: "", generic: false })}><option value="">Elegir</option>{models.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
          <label className="wholesale-sale-cell"><span>Nombre</span><select required aria-label={`Nombre ${index + 1}`} value={item.name} disabled={!item.model} onChange={(event) => { const name = event.target.value; const matches = inType.filter((product) => product.model.trim() === name); patchItem(item.key, { name, productId: matches.length === 1 ? String(matches[0].id) : "", generic: false }); }}><option value="">Elegir</option>{names.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label className="wholesale-sale-cell"><span>Variante</span><select required aria-label={`Variante ${index + 1}`} value={item.generic ? "generic" : item.productId} disabled={!item.name} onChange={(event) => { const value = event.target.value; if (value === "generic") patchItem(item.key, { productId: String(variants[0]?.id ?? ""), generic: true }); else patchItem(item.key, { productId: value, generic: false }); }}><option value="">Elegir</option>{variants.map((product) => <option key={product.id} value={product.id}>{product.variant.trim() || "Única"}</option>)}{genericOk && <option value="generic">{GENERIC_WHOLESALE_VARIANT}</option>}</select></label>
          <label className="wholesale-sale-cell"><span>Cantidad</span><input type="number" min="1" step="1" required aria-label={`Cantidad ${index + 1}`} value={item.quantity} onChange={(event) => patchItem(item.key, { quantity: Number(event.target.value) })} /></label>
          <div className="wholesale-sale-value wholesale-sale-amount" data-label="Importe ARS"><strong>{selectedProduct ? saleArg(lineTotal) : "—"}</strong>{selectedProduct && item.quantity > 1 && !item.noCost && <small>{saleArg(Number(selectedProduct.price_arg) || 0)} c/u</small>}</div>
          <label className="wholesale-sale-checkbox"><input type="checkbox" aria-label={`Sin costo ${index + 1}`} checked={item.noCost} onChange={(event) => patchItem(item.key, { noCost: event.target.checked })} /><span>Sin costo</span></label>
          <button type="button" className="wholesale-sale-remove" aria-label={`Eliminar ${selectedProduct ? productLabel(selectedProduct) : `artículo ${index + 1}`}`} title="Eliminar artículo" onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}><Trash size={19} aria-hidden="true" /></button>
        </div>;
      })}</div> : <div className="wholesale-sale-empty">Todavía no agregaste artículos.</div>}
    </section>

    <section className="local-sale-section wholesale-sale-section">
      <div className="wholesale-sale-section-heading"><h2>Cliente</h2>{!customer && <button type="button" className="primary" onClick={() => setAdding(true)}><Plus size={18} aria-hidden="true" />Agregar cliente</button>}</div>
      <div className="wholesale-sale-single-field"><label className="wholesale-sale-customer-search">Buscar cliente<span><MagnifyingGlass size={18} aria-hidden="true" /><input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Nombre del cliente" /></span></label>
        {customerSearch.trim() && <div className="wholesale-sale-customer-results" aria-label="Resultados de clientes">{customerMatches.map((entry) => <button type="button" key={entry.full_name} onClick={() => { setCustomer(entry.full_name); setCustomerSearch(""); }}>{customerLabel(entry)}</button>)}{!customerMatches.length && <div className="wholesale-sale-no-results">No hay clientes con esa búsqueda.</div>}</div>}
        <label>Cliente
        <select required value={customer} onChange={(event) => setCustomer(event.target.value)}><option value="">Seleccionar cliente</option>{visibleCustomers.map((entry) => <option key={entry.full_name} value={entry.full_name}>{customerLabel(entry)}</option>)}</select>
      </label></div>
    </section>

    <section className="local-sale-section wholesale-sale-section">
      <h2>Datos de la venta</h2>
      <div className="wholesale-sale-single-field"><label>Canal de venta<input value="Mayorista" readOnly /></label></div>
      <small className="wholesale-sale-note">El pedido se guardará en el tablero de producción mayorista con su número #M.</small>
    </section>

    <section className="local-sale-section wholesale-sale-section">
      <h2>Descuentos</h2>
      <div className="wholesale-sale-discount-row">
        <label className="wholesale-sale-discount-toggle">Aplicar descuento<select aria-label="Aplicar descuento" value={applyDiscount ? "si" : "no"} onChange={(event) => setApplyDiscount(event.target.value === "si")}><option value="no">No</option><option value="si">Sí</option></select></label>
        {applyDiscount && <label className="wholesale-sale-discount-percent">Porcentaje<span><input type="number" min="0" max="100" step="0.5" inputMode="decimal" aria-label="Porcentaje de descuento" value={discountText} onChange={(event) => setDiscountText(event.target.value)} /><b aria-hidden="true">%</b></span></label>}
      </div>
    </section>

    <footer className="wholesale-sale-footer">
      <div><small>Total estimado</small>{discountPercent > 0 && estimated > 0 ? <strong className="wholesale-sale-total-discounted"><s>{saleArg(estimated)}</s><span>{saleArg(discounted)}</span><em>-{discountPercent}%</em></strong> : <strong>{saleArg(estimated)}</strong>}</div>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary" type="submit" disabled={busy || !items.length}><Plus size={18} aria-hidden="true" />{busy ? "Guardando…" : "Crear pedido mayorista"}</button>
    </footer>
    </div>
    <aside className="local-sale-photo-panel" aria-label="Fotos de los artículos de la venta">
      <h2>Vista de la venta</h2>
      {!photoLines.length ? <p className="local-sale-photo-empty">Las fotos de los artículos que agregues aparecerán acá.</p> : <div className="local-sale-photo-list">{photoLines.map(({ item, product }) => { const url = imageOf(product); const variant = item.generic ? GENERIC_WHOLESALE_VARIANT : product.variant.trim(); return <article key={item.key} className="local-sale-photo-item">
        <div className="local-sale-photo-frame">{url ? <img src={url} alt={`Foto de ${product.model.trim()}`} /> : "Sin foto"}</div>
        <div><strong>{product.model.trim()}</strong>{variant && <small>{variant}</small>}<small>{item.quantity} {item.quantity === 1 ? "unidad" : "unidades"}{item.noCost ? " · Sin costo" : ""}</small></div>
      </article>; })}</div>}
    </aside>
  </form>
  {adding && <Modal title="Nuevo cliente" onClose={() => setAdding(false)}><WholesaleCustomerEditor onSaved={(name) => { void (async () => { await props.refresh?.(); if (name) { setCustomer(name); setCustomerSearch(""); } setAdding(false); })(); }} onDeleted={() => setAdding(false)} /></Modal>}
  </>;
}

export function WholesaleCustomerEditor({ customer, onSaved, onDeleted }: { customer?: Customer; onSaved: (fullName?: string) => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (!customer?.wholesaleName || busy) return;
    setBusy(true); setError("");
    try {
      const lines = await countWholesaleCustomerLines(customer.wholesaleName);
      if (lines > 0) throw new Error(`No se puede eliminar este cliente: tiene ${lines} ${lines === 1 ? "línea de pedido vinculada" : "líneas de pedido vinculadas"}. La ficha y el historial se conservaron.`);
      if (!window.confirm(`¿Eliminar definitivamente a ${customer.name} de la base de clientes mayoristas? Esta acción no se puede deshacer.`)) return;
      await deleteWholesaleCustomer(customer.wholesaleName);
      onDeleted();
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = readCustomerForm(event.currentTarget);
    const cleanName = form.name;
    const parts = cleanName.split(" ");
    const value: WholesaleCustomer = {
      full_name: cleanName, first_name: parts[0], last_name: parts.slice(1).join(" "),
      company_name: form.company || null, phone: form.phone || null, email: form.email || null,
      birth_date: form.birthDate || null, city: form.city || null, country: form.country || null,
      department: form.department || null, postal_code: form.postalCode || null,
      additional_phones: form.additionalPhones, inferred_category: form.inferredCategory || null,
      product_interest: form.productInterest || null,
      address: form.address || null, notes: form.notes || null,
      origin_channel: form.originChannel as WholesaleCustomer["origin_channel"],
      customer_type: form.customerType as WholesaleCustomer["customer_type"],
    };
    try { await saveWholesaleCustomer(value, customer?.wholesaleName); onSaved(cleanName); }
    catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  return <form className="wholesale-editor" onSubmit={(event) => void submit(event)}>
    <CustomerFormFields customer={customer ? { ...customer, name: customer.wholesaleName || customer.name } : undefined} defaultOrigin="WhatsApp" defaultType="Mayorista" typeLocked={!customer} nameRequired />
    {error && <div className="error" role="alert">{error}</div>}
    <div className="wholesale-customer-actions">
      {customer && <button className="wholesale-customer-delete" type="button" aria-label={`Eliminar ${customer.name}`} title={`Eliminar ${customer.name}`} disabled={busy} onClick={() => void remove()}><Trash size={20} aria-hidden="true" /></button>}
      <button className="primary" disabled={busy} type="submit">{busy ? "Procesando…" : "Guardar cliente"}</button>
    </div>
  </form>;
}

function WholesaleLineEditor({ line, snapshot, displayModel, displayVariant, catalogProduct, openProduct, refresh, notify, initialEditing = false }: { line: WholesaleLine; snapshot: WholesaleSnapshot; displayModel: string; displayVariant: string; catalogProduct?: Product; openProduct: (product: Product) => void; refresh?: () => Promise<void>; notify: (message: string) => void; initialEditing?: boolean }) {
  const [editing, setEditing] = useState(initialEditing);
  const [model, setModel] = useState(line.model);
  const [variant, setVariant] = useState(line.variant);
  const [quantity, setQuantity] = useState(line.quantity);
  const [status, setStatus] = useState(line.status);
  const [customer, setCustomer] = useState(line.customer);
  const [orderId, setOrderId] = useState(line.order_id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act(action: "save" | "complete" | "delete") {
    if (action === "delete" && !window.confirm("¿Eliminar esta línea de producción? Esta acción no se puede deshacer.")) return;
    setBusy(true); setError("");
    try {
      if (action === "save") await updateWholesaleLine(line, { model, variant, quantity, status, customer, orderId });
      else if (action === "complete") await completeWholesaleLine(line.line_id);
      else await deleteWholesaleLine(line.line_id);
      setEditing(false); await refresh?.(); notify(action === "complete" ? "Línea completada" : action === "delete" ? "Línea eliminada" : "Línea actualizada");
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  return <div className="wholesale-line-editor">
    {editing ? <div className="wholesale-line-fields">
      <label>Modelo<select value={model} onChange={(event) => { setModel(event.target.value); setVariant(""); }}><option value="">Seleccionar</option>{[...new Set(snapshot.products.map((item) => item.model))].map((value) => <option key={value} value={value}>{naturalCaseName(value)}</option>)}</select></label>
      <label>Variante<select value={variant} onChange={(event) => setVariant(event.target.value)}><option value="">Seleccionar</option>{snapshot.products.filter((item) => item.model === model).map((item) => <option key={item.id} value={item.variant}>{naturalCaseName(item.variant)}</option>)}{(snapshot.products.filter((item) => item.model === model).length > 1 || variant === GENERIC_WHOLESALE_VARIANT) && <option value={GENERIC_WHOLESALE_VARIANT}>{GENERIC_WHOLESALE_VARIANT} (varios colores)</option>}</select></label>
      <label>Cantidad<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
      <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Pendiente</option><option>En producción</option></select></label>
      <label>Cliente<select value={customer} onChange={(event) => setCustomer(event.target.value)}>{snapshot.customers.map((entry) => <option key={entry.full_name} value={entry.full_name}>{naturalCaseName(formatContactName(entry.full_name))}</option>)}</select></label>
      <label>Pedido<input value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="Sin número" /></label>
      <button className="primary compact" disabled={busy || !model || !variant} onClick={() => void act("save")}>Guardar</button>
      <button className="secondary compact" onClick={() => setEditing(false)}>Cancelar</button>
      <button className="secondary compact" disabled={busy} onClick={() => void act("delete")}>Eliminar</button>
    </div> : <div className="wholesale-line-row">
      <button type="button" className="wholesale-line-thumb" disabled={!catalogProduct} aria-label={`Abrir ${displayModel}`} title={catalogProduct ? "Ir al producto" : undefined} onClick={() => catalogProduct && openProduct(catalogProduct)}>{catalogProduct?.imageUrl ? <img src={catalogProduct.imageUrl} alt="" style={catalogProduct.imageCrop ? { transform: `translate(${catalogProduct.imageCrop.x}%, ${catalogProduct.imageCrop.y}%) scale(${catalogProduct.imageCrop.zoom})` } : undefined} /> : <span>—</span>}</button>
      {catalogProduct?.sku ? <button type="button" className="text-button wholesale-line-sku" title="Ir al producto" onClick={() => openProduct(catalogProduct)}>{catalogProduct.sku}</button> : <span className="wholesale-line-sku">—</span>}
      <strong className="wholesale-line-name">{displayModel}</strong>
      <span className="wholesale-line-variant">{displayVariant}</span>
      <span className="wholesale-line-units">{line.quantity} u.</span>
      <Badge tone={wholesaleStatusTone(line.status)}>{line.status}</Badge>
      <div className="table-actions">{line.status !== "Completado" && <><button className="secondary compact" onClick={() => setEditing(true)}>Editar</button><button className="secondary compact" disabled={busy} onClick={() => void act("complete")}>Completar</button></>}<button className="secondary compact" disabled={busy} onClick={() => void act("delete")}>Eliminar</button></div></div>}
    {error && <div className="error" role="alert">{error}</div>}
  </div>;
}

/** Descuento del pedido completo (no por artículo): útil para cargar descuentos de pedidos viejos. */
function WholesaleOrderDiscount({ lines, snapshot, currency, refresh, notify }: { lines: WholesaleLine[]; snapshot: WholesaleSnapshot; currency: WholesaleCurrency; refresh?: () => Promise<void> | void; notify: (message: string) => void }) {
  const current = orderDiscountPercent(lines);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(current || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const productOf = (line: WholesaleLine) => snapshot.products.find((product) => wholesaleProductKey(product.model, product.variant) === wholesaleProductKey(line.model, line.variant));
  const values = lines.map((line) => wholesaleLineValue(line, productOf(line), snapshot.exchangeRate));
  const summary = discountSummary(values.map((value) => currency === "ARS" ? { gross: value.grossArg, net: value.arg } : { gross: value.grossUyu, net: value.uyu }));
  async function save() {
    const percent = parseDiscountPercent(text);
    setBusy(true); setError("");
    try {
      const rows = lines.map((line, index) => {
        const noCost = line.order_type === "no_cost";
        if (!noCost && line.unit_price_arg == null && !productOf(line)) throw new Error(`No se encontró el producto "${line.model} · ${line.variant}" para calcular el descuento.`);
        return { lineId: line.line_id, quantity: Number(line.quantity), noCost, unitArg: values[index].unitArg, unitUyu: values[index].unitUyu, exchangeRate: Number(line.exchange_rate ?? snapshot.exchangeRate) };
      });
      await setWholesaleOrderDiscount(rows, percent);
      setEditing(false); await refresh?.(); notify(percent ? `Descuento del ${formatPercent(percent)} aplicado al pedido` : "Descuento quitado del pedido");
    } catch (failure) { setError(errorText(failure)); await refresh?.(); }
    finally { setBusy(false); }
  }
  return <div className="wholesale-order-discount">
    {editing ? <>
      <label className="wholesale-sale-discount-percent">Descuento del pedido<span><input type="number" min="0" max="100" step="0.5" inputMode="decimal" autoFocus aria-label="Porcentaje de descuento del pedido" value={text} onChange={(event) => setText(event.target.value)} /><b aria-hidden="true">%</b></span></label>
      <button type="button" className="primary compact" disabled={busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar"}</button>
      <button type="button" className="secondary compact" disabled={busy} onClick={() => { setEditing(false); setText(String(current || "")); setError(""); }}>Cancelar</button>
    </> : <>
      <div><small>Descuento</small>{current > 0 && summary.discount > 0 ? <strong>{formatPercent(current)} · −{wholesaleMoney(summary.discount, currency)}<span> sobre {wholesaleMoney(summary.subtotal, currency)}</span></strong> : <strong className="is-none">Sin descuento</strong>}</div>
      <button type="button" className="secondary compact" onClick={() => setEditing(true)}>{current > 0 ? "Editar descuento" : "Aplicar descuento"}</button>
    </>}
    {error && <div className="error" role="alert">{error}</div>}
  </div>;
}

export function WholesaleOrderModal({ order, props, onClose, currency = "UYU", editingLineId = null }: { order: Order; props: PageProps; onClose: () => void; currency?: WholesaleCurrency; editingLineId?: string | null }) {
  const snapshot = snapshotOf(props);
  if (!snapshot) return null;
  const customer = props.s.customers.find((item) => item.id === order.customerId);
  const lines = snapshot.lines.filter((line) => order.items?.some((item) => item.wholesaleLineId === line.line_id));
  const argTotal = lines.reduce((sum, line) => sum + wholesaleLineValue(line, snapshot.products.find((product) => product.model === line.model && product.variant === line.variant), snapshot.exchangeRate).arg, 0);
  const totalUyu = total(order);
  const paidUyu = paid(props.s, order);
  const shownTotal = currency === "ARS" ? argTotal : totalUyu;
  const shownPaid = currency === "ARS" ? totalUyu > 0 ? argTotal * paidUyu / totalUyu : 0 : paidUyu;
  const shownBalance = currency === "ARS" ? Math.max(0, shownTotal - shownPaid) : balance(props.s, order);
  const downloadPdf = (kind: WholesaleOrderPdfKind) => {
    void exportWholesaleOrderPdf(kind, {
      reference: orderName(order), date: order.date,
      customerName: customer?.name || order.customerName || lines[0]?.customer || "Cliente sin nombre",
      customer, items: order.items, lines, snapshot, currency,
    }).catch((failure) => props.notify(errorText(failure)));
  };
  async function removeOrder() {
    if (!lines.length || !window.confirm(`¿Eliminar el pedido ${orderName(order)} completo, con sus ${lines.length} ${lines.length === 1 ? "línea" : "líneas"}? Esta acción no se puede deshacer.`)) return;
    try {
      for (const line of lines) await deleteWholesaleLine(line.line_id);
      await props.refresh?.(); props.notify(`Pedido ${orderName(order)} eliminado`); onClose();
    } catch (failure) { props.notify(errorText(failure)); await props.refresh?.(); }
  }
  return <Modal title={orderName(order)} onClose={onClose} className="wholesale-order-dialog">
    <div className="detail-banner"><div><small>{formatDate(order.date)} · Mayorista</small><h3>{naturalCaseName(customer?.name || order.customerName || "Cliente sin nombre")}</h3></div><strong>{wholesaleMoney(shownTotal, currency)}</strong></div>
    <Stats items={[{ label: "Unidades", value: order.quantity }, { label: "Cobrado", value: wholesaleMoney(shownPaid, currency) }, { label: "Por cobrar", value: wholesaleMoney(shownBalance, currency) }]} />
    {lines.length > 0 && <WholesaleOrderDiscount lines={lines} snapshot={snapshot} currency={currency} refresh={props.refresh} notify={props.notify} />}
    <div className="wholesale-line-list"><div className="wholesale-line-row wholesale-line-head" aria-hidden="true"><span>Foto</span><span>SKU</span><span>Nombre</span><span>Variante</span><span>Unidades</span><span>Estado</span><span></span></div>{lines.map((line) => {
      const orderItem = order.items?.find((item) => item.wholesaleLineId === line.line_id);
      const isGeneric = normalizeWholesaleText(line.variant) === normalizeWholesaleText(GENERIC_WHOLESALE_VARIANT);
      const exact = isGeneric ? undefined : props.s.products.find((product) => product.id === orderItem?.productId);
      // Línea "Genérico": se toma como referencia el primer SKU y la primera foto de ese producto.
      const siblings = isGeneric && !exact ? props.s.products.filter((product) => !product.wholesaleProductId && normalizeWholesaleText(product.name) === normalizeWholesaleText(line.model)).sort((x, y) => x.sku.localeCompare(y.sku, "es", { numeric: true })) : [];
      const photoReference = siblings.find((product) => product.imageUrl);
      const catalogProduct = exact || (siblings[0] ? { ...siblings[0], imageUrl: photoReference?.imageUrl, imageCrop: photoReference?.imageCrop } : undefined);
      return <WholesaleLineEditor key={line.line_id} line={line} snapshot={snapshot} displayModel={catalogProduct?.name || naturalCaseName(line.model)} displayVariant={isGeneric ? GENERIC_WHOLESALE_VARIANT : catalogProduct?.variant || naturalCaseName(line.variant)} catalogProduct={catalogProduct} openProduct={(entry) => props.go(`/productos/catalogo?producto=${encodeURIComponent(entry.sourceProductId || entry.id)}&variante=${encodeURIComponent(entry.id)}`)} refresh={props.refresh} notify={props.notify} initialEditing={editingLineId === line.line_id} />;
    })}</div>
    <div className="form-actions"><button className="secondary" disabled={!lines.length} onClick={() => downloadPdf("workshop")}>Descargar PDF Taller</button><button className="secondary" disabled={!lines.length} onClick={() => downloadPdf("customer")}>Descargar PDF Cliente</button><button className="text-button" onClick={() => props.go(`/clientes/base?cliente=${encodeURIComponent(order.customerId)}`)}>Ver cliente</button><button className="secondary" onClick={() => void removeOrder()}>Eliminar pedido</button></div>
  </Modal>;
}

export function WholesaleProduction({ props, history = false }: { props: PageProps; history?: boolean }) {
  const snapshot = snapshotOf(props);
  const [group, setGroup] = useState("Pedidos");
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [currency, setCurrency] = useState<WholesaleCurrency>("ARS");
  const [sort, setSort] = useState<{ key: "fecha" | "cantidad" | "total"; direction: "asc" | "desc" }>({ key: "fecha", direction: "desc" });
  const [selected, setSelected] = useState<string | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const products = useMemo(() => {
    const matched = new Map<string, WholesaleProduct>();
    for (const product of snapshot?.products || []) {
      const key = wholesaleProductKey(product.model, product.variant);
      if (!matched.has(key)) matched.set(key, product);
    }
    return matched;
  }, [snapshot]);
  const catalogProducts = useMemo(() => new Map(props.s.products.flatMap((product) => [
    [product.id, product] as const,
    ...(product.wholesaleProductId ? [[`wholesale:${product.wholesaleProductId}`, product] as const] : []),
  ])), [props.s.products]);
  if (!snapshot) return <div className="empty">Cargando producción mayorista…</div>;
  const baseLines = snapshot.lines.filter((line) => history ? line.status === "Completado" : line.status !== "Completado");
  const productFor = (line: WholesaleLine) => products.get(wholesaleProductKey(line.model, line.variant));
  const displayNames = (line: WholesaleLine) => {
    const wholesaleProduct = productFor(line);
    const catalogProduct = wholesaleProduct?.commerce_variant_id ? catalogProducts.get(wholesaleProduct.commerce_variant_id) : wholesaleProduct ? catalogProducts.get(`wholesale:${wholesaleProduct.id}`) : undefined;
    return {
      model: catalogProduct?.name || naturalCaseName(wholesaleProduct?.model || line.model),
      variant: catalogProduct?.variant || naturalCaseName(wholesaleProduct?.variant || line.variant),
    };
  };
  const companyOf = (value: string) => props.s.customers.find((customer) => customer.wholesaleName === value)?.companyName?.trim() || "";
  const displayCustomer = (value: string) => naturalCaseName(props.s.customers.find((customer) => customer.wholesaleName === value)?.name || formatContactName(value));
  const valueFor = (line: WholesaleLine) => {
    const value = wholesaleLineValue(line, productFor(line), snapshot.exchangeRate);
    return currency === "ARS" ? value.arg : value.uyu;
  };
  const lines = baseLines.filter((line) => (!customerFilter || line.customer === customerFilter) && (!modelFilter || line.model === modelFilter))
    .sort((a, b) => {
      const comparison = sort.key === "fecha" ? (history ? a.completed_at || "" : a.created_at || "").localeCompare(history ? b.completed_at || "" : b.created_at || "")
        : sort.key === "cantidad" ? Number(a.quantity) - Number(b.quantity) : valueFor(a) - valueFor(b);
      return (sort.direction === "desc" ? -comparison : comparison) || a.line_id.localeCompare(b.line_id);
    });
  const summaryLines = group === "Cuero Torpedo"
    ? lines.filter((line) => normalizeWholesaleText(line.model) === "torpedo")
    : group === "Virolas"
      ? lines.filter((line) => { const rim = productFor(line)?.rim_type?.trim(); return Boolean(rim && rim !== "-"); })
      : lines;
  const customers = [...new Set(baseLines.map((line) => line.customer))].sort((a, b) => displayCustomer(a).localeCompare(displayCustomer(b), "es"));
  const models = [...new Set(baseLines.map((line) => line.model))].sort((a, b) => a.localeCompare(b, "es"));
  const changeSort = (key: typeof sort.key) => setSort((current) => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" }));
  const sortHeader = (label: string, key: typeof sort.key) => <button type="button" className="wholesale-sort-button" onClick={() => changeSort(key)} aria-label={`Ordenar ${label.toLowerCase()} de ${sort.key === key && sort.direction === "desc" ? "menor a mayor" : "mayor a menor"}`} aria-pressed={sort.key === key}>{label}{sort.key === key ? sort.direction === "desc" ? <ArrowDown size={15} aria-hidden="true" /> : <ArrowUp size={15} aria-hidden="true" /> : <ArrowDown size={15} aria-hidden="true" className="wholesale-sort-idle" />}</button>;
  const columnFilter = (label: string, value: string, setValue: (value: string) => void, options: string[], display: (value: string) => string) => <label className={`wholesale-column-filter${value ? " is-active" : ""}`} title={value ? `${label}: ${display(value)}` : `Filtrar ${label.toLowerCase()}`}>
    <span aria-hidden="true">{label}</span><CaretDown size={14} aria-hidden="true" />
    <select aria-label={`Filtrar ${label.toLowerCase()}`} value={value} onChange={(event) => setValue(event.target.value)}><option value="">Todos</option>{options.map((option) => <option key={option} value={option}>{display(option)}</option>)}</select>
  </label>;
  const customerHeader = columnFilter("Cliente", customerFilter, setCustomerFilter, customers, displayCustomer);
  const modelHeader = columnFilter("Modelo", modelFilter, setModelFilter, models, (value) => displayNames(baseLines.find((line) => line.model === value)!).model);
  const clearFilters = () => { setCustomerFilter(""); setModelFilter(""); setSearch(""); setSort({ key: "fecha", direction: "desc" }); };
  const hasFilters = Boolean(customerFilter || modelFilter || search || sort.key !== "fecha" || sort.direction !== "desc");
  const openLine = (lineId: string, edit = false) => { setEditingLineId(edit ? lineId : null); setSelected(lineId); };
  const completeLine = async (line: WholesaleLine) => {
    if (busyLineId) return;
    setActionError(""); setBusyLineId(line.line_id);
    try { await completeWholesaleLine(line.line_id); await props.refresh?.(); props.notify("Línea completada"); }
    catch (failure) { setActionError(errorText(failure)); }
    finally { setBusyLineId(null); }
  };
  const deleteLine = async (line: WholesaleLine) => {
    if (busyLineId) return;
    const code = line.order_id || `Línea ${line.line_id}`;
    if (!window.confirm(`¿Eliminar ${code} (${displayNames(line).model} · ${displayNames(line).variant}, ${line.quantity} u.)? Si es la única línea del pedido, el pedido también se elimina. Esta acción no se puede deshacer.`)) return;
    setActionError(""); setBusyLineId(line.line_id);
    try { await deleteWholesaleLine(line.line_id); await props.refresh?.(); props.notify(`${code} eliminado`); }
    catch (failure) { setActionError(errorText(failure)); }
    finally { setBusyLineId(null); }
  };
  const groupKey = (line: WholesaleLine) => {
    const names = displayNames(line);
    return group === "Modelo" ? names.model
      : group === "Variante" ? `${names.model}\u0000${names.variant}`
        : group === "Virolas" ? naturalCaseName(productFor(line)?.rim_type?.trim() || "")
          : naturalCaseName(productFor(line)?.leather_type?.trim() || "") || "Sin especificar";
  };
  const summaries = [...summaryLines.reduce((map, line) => {
    const names = displayNames(line);
    const key = groupKey(line);
    const current = map.get(key) || { id: key, name: group === "Variante" ? `${names.model} ${names.variant}` : key, model: names.model, variant: names.variant, pending: 0, inProduction: 0, completed: 0, quantity: 0, total: 0, latestDate: "" };
    current.quantity += line.quantity;
    current.total += valueFor(line);
    current.latestDate = [current.latestDate, line.created_at || ""].sort().at(-1) || "";
    if (line.status === "Pendiente") current.pending += line.quantity;
    else if (line.status === "Completado") current.completed += line.quantity;
    else current.inProduction += line.quantity;
    map.set(key, current);
    return map;
  }, new Map<string, { id: string; name: string; model: string; variant: string; pending: number; inProduction: number; completed: number; quantity: number; total: number; latestDate: string }>()).values()].sort((a, b) => {
    if (group === "Variante" && sort.key === "fecha") return a.model.localeCompare(b.model, "es") || a.variant.localeCompare(b.variant, "es");
    if ((group === "Virolas" || group === "Cuero Torpedo") && sort.key === "fecha") return b.quantity - a.quantity || a.name.localeCompare(b.name, "es");
    const comparison = sort.key === "fecha" ? a.latestDate.localeCompare(b.latestDate) : sort.key === "cantidad" ? a.quantity - b.quantity : a.total - b.total;
    return (sort.direction === "desc" ? -comparison : comparison) || a.name.localeCompare(b.name, "es");
  });
  const summaryColumns: Column<(typeof summaries)[number]>[] = group === "Variante" ? [
    { label: "Modelo", header: modelHeader, render: (row) => row.model },
    { label: "Variante", render: (row) => row.variant },
    { label: "Pendiente", render: (row) => row.pending },
    { label: "En producción", render: (row) => row.inProduction },
    { label: "Total", header: sortHeader("Total", "cantidad"), sortDirection: sort.key === "cantidad" ? sort.direction === "desc" ? "descending" : "ascending" : "none", render: (row) => <strong>{row.quantity}</strong> },
  ] : group === "Virolas" || group === "Cuero Torpedo" ? [
    { label: group === "Virolas" ? "Tipo de virola" : "Tipo de cuero", render: (row) => row.name },
    { label: "Pendiente", render: (row) => row.pending },
    { label: "En producción", render: (row) => row.inProduction },
    { label: "Total", header: sortHeader("Total", "cantidad"), sortDirection: sort.key === "cantidad" ? sort.direction === "desc" ? "descending" : "ascending" : "none", render: (row) => <strong>{row.quantity}</strong> },
  ] : [
    { label: group, header: group === "Modelo" ? modelHeader : undefined, render: (row) => row.name },
    { label: "Pendientes", render: (row) => row.pending },
    { label: "En producción", render: (row) => row.inProduction },
    { label: "Cantidad", header: sortHeader("Cantidad", "cantidad"), sortDirection: sort.key === "cantidad" ? sort.direction === "desc" ? "descending" : "ascending" : "none", render: (row) => row.quantity },
  ];
  // Con una vista agrupada activa (Modelo, Variante, Virolas, Cuero Torpedo) los botones exportan esa tabla tal cual se ve.
  const viewTable: WholesaleViewTable | null = history || group === "Pedidos" ? null : {
    title: `Producción mayorista · ${group}`, slug: group,
    headings: group === "Variante" ? ["Modelo", "Variante", "Pendiente", "En producción", "Total"]
      : group === "Virolas" ? ["Tipo de virola", "Pendiente", "En producción", "Total"]
        : group === "Cuero Torpedo" ? ["Tipo de cuero", "Pendiente", "En producción", "Total"]
          : ["Modelo", "Pendientes", "En producción", "Cantidad"],
    rows: summaries.map((row): Record<string, string | number> => group === "Variante" ? { Modelo: row.model, Variante: row.variant, Pendiente: row.pending, "En producción": row.inProduction, Total: row.quantity }
      : group === "Virolas" ? { "Tipo de virola": row.name, Pendiente: row.pending, "En producción": row.inProduction, Total: row.quantity }
        : group === "Cuero Torpedo" ? { "Tipo de cuero": row.name, Pendiente: row.pending, "En producción": row.inProduction, Total: row.quantity }
          : { Modelo: row.name, Pendientes: row.pending, "En producción": row.inProduction, Cantidad: row.quantity }),
  };
  const nothingToExport = viewTable ? !viewTable.rows.length : !lines.length;
  const selectedOrder = props.s.orders.find((order) => order.source === "wholesale" && order.items?.some((item) => item.wholesaleLineId === selected));
  const historyFilters = history ? <details className="wholesale-compact-filters is-orders wholesale-history-filters"><summary aria-label="Filtros y orden" title="Filtros y orden"><Funnel size={19} aria-hidden="true" /></summary><div className="wholesale-compact-filters-panel"><label>Cliente<select aria-label="Filtrar cliente en histórico mayorista" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value="">Todos</option>{customers.map((option) => <option key={option} value={option}>{displayCustomer(option)}</option>)}</select></label><label>Modelo<select aria-label="Filtrar modelo en histórico mayorista" value={modelFilter} onChange={(event) => setModelFilter(event.target.value)}><option value="">Todos</option>{models.map((option) => <option key={option} value={option}>{displayNames(baseLines.find((line) => line.model === option)!).model}</option>)}</select></label><label>Ordenar<select aria-label="Ordenar histórico mayorista" value={`${sort.key}:${sort.direction}`} onChange={(event) => { const [key, direction] = event.target.value.split(":") as [typeof sort.key, typeof sort.direction]; setSort({ key, direction }); }}><option value="fecha:desc">Fecha: más recientes</option><option value="fecha:asc">Fecha: más antiguos</option><option value="cantidad:desc">Cantidad: mayor a menor</option><option value="cantidad:asc">Cantidad: menor a mayor</option><option value="total:desc">Total: mayor a menor</option><option value="total:asc">Total: menor a mayor</option></select></label></div></details> : undefined;
  return <section className="wholesale-production">
    <Stats items={[{ label: history ? "Líneas terminadas" : "Líneas activas", value: summaryLines.length }, { label: "Unidades", value: summaryLines.reduce((sum, line) => sum + Number(line.quantity), 0) }, { label: "Pedidos", value: new Set(summaryLines.map((line) => line.order_id || line.line_id)).size }]} />
    <div className="wholesale-production-actions"><label className="wholesale-currency-picker">Moneda<select aria-label="Moneda mayorista" value={currency} onChange={(event) => setCurrency(event.target.value as WholesaleCurrency)}><option value="UYU">UYU · pesos uruguayos</option><option value="ARS">ARS · pesos argentinos</option></select></label>
      <div className="table-actions"><button className="secondary wholesale-export-button" disabled={nothingToExport} onClick={() => viewTable ? void exportWholesaleViewXlsx(viewTable) : exportWholesaleXlsx(lines, snapshot, currency)}>Excel</button><button className="secondary wholesale-export-button" disabled={nothingToExport} onClick={() => viewTable ? void exportWholesaleViewPdf(viewTable) : exportWholesalePdf(history ? "Histórico mayorista" : "Producción mayorista", lines, snapshot, currency)}>PDF</button><button className="secondary wholesale-export-button" disabled={nothingToExport} onClick={() => viewTable ? exportWholesaleViewCsv(viewTable) : exportWholesaleCsv(lines, snapshot, currency)}>CSV</button></div></div>
    {!history && <div className="wholesale-production-viewbar"><div className="tabs inner-tabs">{["Pedidos", "Modelo", "Variante", "Virolas", "Cuero Torpedo"].map((value) => <button key={value} className={group === value ? "active" : ""} onClick={() => { setGroup(value); setSort({ key: "fecha", direction: "desc" }); }}>{value}</button>)}</div><div className="wholesale-production-view-actions"><button type="button" className="wholesale-icon-button wholesale-clear-filters" aria-label="Quitar filtros" title="Quitar filtros" disabled={!hasFilters} onClick={clearFilters}><FunnelX size={19} aria-hidden="true" /></button><details className={`wholesale-compact-filters${group === "Pedidos" ? " is-orders" : ""}`}><summary aria-label="Filtros y orden" title="Filtros y orden"><Funnel size={19} aria-hidden="true" /></summary><div className="wholesale-compact-filters-panel"><label>Cliente<select aria-label="Filtrar cliente en vista compacta" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value="">Todos</option>{customers.map((option) => <option key={option} value={option}>{displayCustomer(option)}</option>)}</select></label><label>Modelo<select aria-label="Filtrar modelo en vista compacta" value={modelFilter} onChange={(event) => setModelFilter(event.target.value)}><option value="">Todos</option>{models.map((option) => <option key={option} value={option}>{displayNames(baseLines.find((line) => line.model === option)!).model}</option>)}</select></label><label>Ordenar<select aria-label="Ordenar en vista compacta" value={`${sort.key}:${sort.direction}`} onChange={(event) => { const [key, direction] = event.target.value.split(":") as [typeof sort.key, typeof sort.direction]; setSort({ key, direction }); }}><option value="fecha:desc">Fecha: más recientes</option><option value="fecha:asc">Fecha: más antiguos</option><option value="cantidad:desc">Cantidad: mayor a menor</option><option value="cantidad:asc">Cantidad: menor a mayor</option><option value="total:desc">Total: mayor a menor</option><option value="total:asc">Total: menor a mayor</option></select></label></div></details><label className="search"><MagnifyingGlass size={18} aria-hidden="true" /><input aria-label="Buscar en producción mayorista" placeholder="Buscar…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div></div>}
    {actionError && <div className="error" role="alert">{actionError}</div>}
    {group === "Pedidos" || history ? <Table rows={lines.map((line) => ({ ...line, id: line.line_id }))} showSearch={history} action={historyFilters} className={`wholesale-production-table wholesale-production-orders-table${history ? " wholesale-production-history-table" : ""}`} searchQuery={history ? undefined : search} onSearchQueryChange={history ? undefined : setSearch} searchText={(line) => { const names = displayNames(line); return `${line.order_id || line.line_id} ${displayCustomer(line.customer)} ${names.model} ${names.variant}`; }} columns={[
      { label: "Pedido", render: (line) => <button className="text-button" onClick={() => openLine(line.line_id)}>{line.order_id || `Línea ${line.line_id}`}</button> },
      { label: "Cliente", header: customerHeader, render: (line) => displayCustomer(line.customer) },
      { label: "Empresa", render: (line) => companyOf(line.customer) || "—" },
      { label: "Modelo", header: modelHeader, render: (line) => displayNames(line).model },
      { label: "Variante", render: (line) => displayNames(line).variant },
      { label: "Cantidad", header: sortHeader("Cantidad", "cantidad"), sortDirection: sort.key === "cantidad" ? sort.direction === "desc" ? "descending" : "ascending" : "none", render: (line) => line.quantity },
      { label: "Estado", render: (line) => <Badge tone={wholesaleStatusTone(line.status)}>{line.status}</Badge> },
      { label: history ? "Completado" : "Fecha", header: sortHeader("Fecha", "fecha"), sortDirection: sort.key === "fecha" ? sort.direction === "desc" ? "descending" : "ascending" : "none", render: (line) => formatDate(history ? line.completed_at : line.created_at) },
      { label: "Total", header: sortHeader(`Total ${currency}`, "total"), sortDirection: sort.key === "total" ? sort.direction === "desc" ? "descending" : "ascending" : "none", render: (line) => <span className="wholesale-amount">{wholesaleMoney(valueFor(line), currency)}</span> },
      { label: "Acciones", render: (line) => <div className="wholesale-row-actions">{history ? <button type="button" className="wholesale-icon-button" aria-label={`Ver ${line.order_id || line.line_id}`} title="Ver detalle" onClick={() => openLine(line.line_id)}><Eye size={19} aria-hidden="true" /></button> : <><button type="button" className="wholesale-icon-button wholesale-complete-action" aria-label={`Completar ${line.order_id || line.line_id}`} title="Completar" disabled={Boolean(busyLineId)} onClick={() => void completeLine(line)}><Check size={20} weight="bold" aria-hidden="true" /></button><button type="button" className="wholesale-icon-button" aria-label={`Editar ${line.order_id || line.line_id}`} title="Editar" onClick={() => openLine(line.line_id, true)}><PencilSimple size={19} aria-hidden="true" /></button></>}<button type="button" className="wholesale-icon-button" aria-label={`Eliminar ${line.order_id || line.line_id}`} title="Eliminar" disabled={Boolean(busyLineId)} onClick={() => void deleteLine(line)}><Trash size={19} aria-hidden="true" /></button></div> },
    ]} /> : group === "Virolas" && !summaries.length ? <div className="empty" role="status">No hay tipos de virola registrados en los productos de pedidos activos.</div> : <Table rows={summaries} showSearch={false} className={`wholesale-production-table${group === "Variante" ? " wholesale-variant-summary-table" : ""}`} searchQuery={search} onSearchQueryChange={setSearch} searchText={(row) => row.name} columns={summaryColumns} />}
    {selectedOrder && <WholesaleOrderModal key={`${selectedOrder.id}:${editingLineId || "view"}`} order={selectedOrder} props={props} onClose={() => { setSelected(null); setEditingLineId(null); }} currency={currency} editingLineId={editingLineId} />}
  </section>;
}
