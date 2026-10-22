import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowDown, ArrowUp, CaretDown, Check, Eye, Funnel, FunnelX, MagnifyingGlass, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import type { PageProps } from "./pages";
import type { Customer, Order } from "./data";
import { money, orderName, paid, balance, total } from "./data";
import { Badge, Modal, Stats, Table, type Column } from "./ui";
import { createWholesaleOrder, deleteWholesaleCustomer, countWholesaleCustomerLines, deleteWholesaleLine, completeWholesaleLine, saveWholesaleCustomer, updateWholesaleLine, wholesaleProductImageUrl, type WholesaleCustomer, type WholesaleLine, type WholesaleProduct, type WholesaleProductImage, type WholesaleSnapshot } from "./wholesaleSource";
import { ProductCoverEditor, type ProductCoverCrop } from "./commerce/ProductCoverEditor";
import { exportWholesaleCsv, exportWholesalePdf, exportWholesaleXlsx, type WholesaleCurrency } from "./wholesaleExports";
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
import { GENERIC_WHOLESALE_VARIANT, genericVariantRepresentatives, wholesaleSaleCategory, wholesaleSaleCategoryLabel, wholesaleSaleType, wholesaleSaleVariantLabel } from "./wholesaleSaleSelection";

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
      <div><h2 id="wholesale-summary-title">Resumen mayorista</h2><p>Estado actual de la carga compartida con el dashboard de producción.</p></div>
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
  const [saleChannel, setSaleChannel] = useState<NonNullable<WholesaleLine["sale_channel"]>>("WhatsApp");
  const [items, setItems] = useState([{ key: crypto.randomUUID(), category: "", model: "", productId: "", quantity: 1, noCost: false, generic: false }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!snapshot) return <div className="empty">Cargando producción mayorista…</div>;
  const sortedProducts = snapshot.products.filter(product => product.available_wholesale !== false && wholesaleSaleCategory(product)).sort((a, b) => productLabel(a).localeCompare(productLabel(b), "es"));
  const productMatches = productSearch.trim() ? sortedProducts.filter((product) => `${product.model} ${product.variant} ${product.sku || ""}`.toLocaleLowerCase("es").includes(productSearch.trim().toLocaleLowerCase("es"))).slice(0, 8) : [];
  const sortedCustomers = [...snapshot.customers].sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
  const customerMatches = sortedCustomers.filter((entry) => entry.full_name.toLocaleLowerCase("es").includes(customerSearch.trim().toLocaleLowerCase("es")));
  const visibleCustomers = sortedCustomers.filter((entry) => !customerSearch.trim() || customerMatches.includes(entry) || entry.full_name === customer);
  const estimated = items.reduce((sum, item) => sum + (item.noCost ? 0 : Number(snapshot.products.find((product) => String(product.id) === item.productId)?.price_arg || 0) * item.quantity), 0);
  function chooseProduct(product: WholesaleProduct) {
    setItems((current) => {
      const target = current.find((row) => !row.productId);
      if (target) return current.map((row) => row.key === target.key ? { ...row, category: wholesaleSaleCategory(product) || "", model: wholesaleSaleType(product), productId: String(product.id), generic: false } : row);
      return [...current, { key: crypto.randomUUID(), category: wholesaleSaleCategory(product) || "", model: wholesaleSaleType(product), productId: String(product.id), quantity: 1, noCost: false, generic: false }];
    });
    setProductSearch("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      if (!items.length || !items.every((item) => item.productId && Number.isInteger(item.quantity) && item.quantity > 0)) throw new Error("Revisá productos y cantidades.");
      const orderId = await createWholesaleOrder(customer, items, saleChannel);
      await props.refresh?.(); props.notify(`Pedido ${orderId} creado.`);
      props.go(`/comercial/pedidos?pedido=${encodeURIComponent(`wholesale:${orderId}`)}`);
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  return <form className="wholesale-sale-register" onSubmit={(event) => void submit(event)}>
    <section className="local-sale-section wholesale-sale-section">
      <div className="wholesale-sale-section-heading">
        <div><h2>Artículos</h2><p>Seleccioná cada artículo y la cantidad solicitada.</p></div>
        <button type="button" className="secondary" onClick={() => setItems((current) => [...current, { key: crypto.randomUUID(), category: "", model: "", productId: "", quantity: 1, noCost: false, generic: false }])}><Plus size={18} aria-hidden="true" />Agregar artículo</button>
      </div>
      <div className="wholesale-sale-product-search"><label>Buscar producto<span><MagnifyingGlass size={18} aria-hidden="true" /><input type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Nombre, variante o SKU" /></span></label>
        {productSearch.trim() && <div className="wholesale-sale-search-results" aria-label="Resultados de productos">{productMatches.map((product) => <button type="button" key={product.id} onClick={() => chooseProduct(product)}><span>{wholesaleSaleVariantLabel(product)}<small>{wholesaleSaleCategoryLabel(wholesaleSaleCategory(product)!)}{product.sku ? ` · SKU ${product.sku}` : ""}</small></span><strong>{saleArg(Number(product.price_arg) || 0)}</strong></button>)}{!productMatches.length && <div className="wholesale-sale-no-results">No hay productos mayoristas con esa búsqueda.</div>}</div>}
      </div>
      {items.length ? <div className="wholesale-sale-lines"><div className="wholesale-sale-line-head" aria-hidden="true"><span>Categoría</span><span>Tipo</span><span>Nombre y variante</span><span>Cantidad</span><span>Precio ARS</span><span>Subtotal ARS</span><span>Sin costo</span><span></span></div>{items.map((item, index) => {
        const selectedProduct = snapshot.products.find((product) => String(product.id) === item.productId);
        const lineTotal = item.noCost ? 0 : Number(selectedProduct?.price_arg || 0) * item.quantity;
        const models = [...new Set(sortedProducts.filter((product) => wholesaleSaleCategory(product) === item.category).map(wholesaleSaleType))].sort((a, b) => a.localeCompare(b, "es"));
        const variants = sortedProducts.filter((product) => wholesaleSaleCategory(product) === item.category && wholesaleSaleType(product) === item.model);
        const typeLabel = item.category === "mates" ? "Modelo de mate" : item.category === "materas" ? "Forma" : item.category === "bombillas" || item.category === "bombillones" ? "Tipo de bombilla" : "Tipo";
        return <div className="wholesale-sale-line" key={item.key}>
          <label className="wholesale-sale-cell"><span>Categoría</span><select required aria-label={`Categoría ${index + 1}`} value={item.category} onChange={(event) => setItems(items.map((row) => row.key === item.key ? { ...row, category: event.target.value, model: "", productId: "", generic: false } : row))}><option value="">Elegir</option><option value="mates">Mates</option><option value="materas">Materas</option><option value="bombillas">Bombillas</option><option value="bombillones">Bombillones</option></select></label>
          <label className="wholesale-sale-cell"><span>{typeLabel}</span><select required aria-label={`Tipo ${index + 1}`} value={item.model} disabled={!item.category} onChange={(event) => setItems(items.map((row) => row.key === item.key ? { ...row, model: event.target.value, productId: "", generic: false } : row))}><option value="">{item.category ? `Elegir ${typeLabel.toLocaleLowerCase("es")}` : "Elegir tipo"}</option>{models.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
          <label className="wholesale-sale-cell"><span>Nombre y variante</span><select required aria-label={`Nombre y variante ${index + 1}`} value={item.generic ? `generic:${item.productId}` : item.productId} disabled={!item.model} onChange={(event) => { const generic = event.target.value.startsWith("generic:"); setItems(items.map((row) => row.key === item.key ? { ...row, productId: event.target.value.replace(/^generic:/, ""), generic } : row)); }}><option value="">Elegir nombre y variante</option>{variants.map((product) => <option key={product.id} value={product.id}>{wholesaleSaleVariantLabel(product)}</option>)}{genericVariantRepresentatives(variants).map((product) => <option key={`generic-${product.id}`} value={`generic:${product.id}`}>{product.model.trim()} · {GENERIC_WHOLESALE_VARIANT} (varios colores)</option>)}</select></label>
          <label className="wholesale-sale-cell"><span>Cantidad</span><input type="number" min="1" step="1" required aria-label={`Cantidad ${index + 1}`} value={item.quantity} onChange={(event) => setItems(items.map((row) => row.key === item.key ? { ...row, quantity: Number(event.target.value) } : row))} /></label>
          <div className="wholesale-sale-value" data-label="Precio ARS">{selectedProduct ? saleArg(Number(selectedProduct.price_arg) || 0) : "—"}</div>
          <strong className="wholesale-sale-value" data-label="Subtotal ARS">{selectedProduct ? saleArg(lineTotal) : "—"}</strong>
          <label className="wholesale-sale-checkbox"><input type="checkbox" aria-label={`Sin costo ${index + 1}`} checked={item.noCost} onChange={(event) => setItems(items.map((row) => row.key === item.key ? { ...row, noCost: event.target.checked } : row))} /><span>Sin costo</span></label>
          <button type="button" className="wholesale-sale-remove" aria-label={`Eliminar ${selectedProduct ? productLabel(selectedProduct) : `artículo ${index + 1}`}`} title="Eliminar artículo" onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}><Trash size={19} aria-hidden="true" /></button>
        </div>;
      })}</div> : <div className="wholesale-sale-empty">Todavía no agregaste artículos.</div>}
    </section>

    <section className="local-sale-section wholesale-sale-section">
      <h2>Cliente</h2>
      <div className="wholesale-sale-single-field"><label className="wholesale-sale-customer-search">Buscar cliente<span><MagnifyingGlass size={18} aria-hidden="true" /><input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Nombre del cliente" /></span></label>
        {customerSearch.trim() && <div className="wholesale-sale-customer-results" aria-label="Resultados de clientes">{customerMatches.map((entry) => <button type="button" key={entry.full_name} onClick={() => { setCustomer(entry.full_name); setCustomerSearch(""); }}>{formatContactName(entry.full_name)}</button>)}{!customerMatches.length && <div className="wholesale-sale-no-results">No hay clientes con esa búsqueda.</div>}</div>}
        <label>Cliente
        <select required value={customer} onChange={(event) => setCustomer(event.target.value)}><option value="">Seleccionar cliente</option>{visibleCustomers.map((entry) => <option key={entry.full_name} value={entry.full_name}>{formatContactName(entry.full_name)}</option>)}</select>
      </label></div>
    </section>

    <section className="local-sale-section wholesale-sale-section">
      <h2>Datos de la venta</h2>
      <div className="wholesale-sale-single-field"><label>Canal de venta<select value={saleChannel} onChange={(event) => setSaleChannel(event.target.value as typeof saleChannel)}>{["WhatsApp", "Local", "Web", "Instagram", "Facebook", "Feria"].map((value) => <option key={value}>{value}</option>)}</select></label></div>
      <small className="wholesale-sale-note">El pedido se guardará en el tablero de producción mayorista con su número #M.</small>
    </section>

    <footer className="wholesale-sale-footer">
      <div><small>Total estimado</small><strong>{saleArg(estimated)}</strong></div>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary" type="submit" disabled={busy || !items.length}><Plus size={18} aria-hidden="true" />{busy ? "Guardando…" : "Crear pedido mayorista"}</button>
    </footer>
  </form>;
}

export function WholesaleCustomerEditor({ customer, onSaved, onDeleted }: { customer?: Customer; onSaved: () => void; onDeleted: () => void }) {
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
    try { await saveWholesaleCustomer(value, customer?.wholesaleName); onSaved(); }
    catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  return <form className="wholesale-editor" onSubmit={(event) => void submit(event)}>
    <CustomerFormFields customer={customer ? { ...customer, name: customer.wholesaleName || customer.name } : undefined} defaultOrigin="WhatsApp" defaultType="Mayorista" nameRequired />
    {error && <div className="error" role="alert">{error}</div>}
    <div className="wholesale-customer-actions">
      {customer && <button className="wholesale-customer-delete" type="button" aria-label={`Eliminar ${customer.name}`} title={`Eliminar ${customer.name}`} disabled={busy} onClick={() => void remove()}><Trash size={20} aria-hidden="true" /></button>}
      <button className="primary" disabled={busy} type="submit">{busy ? "Procesando…" : "Guardar cliente"}</button>
    </div>
  </form>;
}

function WholesaleLineEditor({ line, snapshot, displayModel, displayVariant, refresh, notify, initialEditing = false }: { line: WholesaleLine; snapshot: WholesaleSnapshot; displayModel: string; displayVariant: string; refresh?: () => Promise<void>; notify: (message: string) => void; initialEditing?: boolean }) {
  const [editing, setEditing] = useState(initialEditing);
  const [model, setModel] = useState(line.model);
  const [variant, setVariant] = useState(line.variant);
  const [quantity, setQuantity] = useState(line.quantity);
  const [status, setStatus] = useState(line.status);
  const [customer, setCustomer] = useState(line.customer);
  const [orderId, setOrderId] = useState(line.order_id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const product = snapshot.products.find((item) => item.model === line.model && item.variant === line.variant);
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
    </div> : <div className="wholesale-line-summary"><span>{displayModel} · {displayVariant} · {line.quantity} u. · <Badge tone={wholesaleStatusTone(line.status)}>{line.status}</Badge>{product && <small> {naturalCaseName(product.rim_type || "")} {naturalCaseName(product.leather_type || "")}</small>}</span><div className="table-actions">{line.status !== "Completado" && <><button className="secondary compact" onClick={() => setEditing(true)}>Editar</button><button className="secondary compact" disabled={busy} onClick={() => void act("complete")}>Completar</button></>}<button className="secondary compact" disabled={busy} onClick={() => void act("delete")}>Eliminar</button></div></div>}
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
  return <Modal title={orderName(order)} onClose={onClose}>
    <div className="detail-banner"><div><small>{order.date} · Mayorista</small><h3>{naturalCaseName(customer?.name || order.customerName || "Cliente sin nombre")}</h3></div><strong>{wholesaleMoney(shownTotal, currency)}</strong></div>
    <Stats items={[{ label: "Unidades", value: order.quantity }, { label: "Cobrado", value: wholesaleMoney(shownPaid, currency) }, { label: "Por cobrar", value: wholesaleMoney(shownBalance, currency) }]} />
    <div className="wholesale-line-list">{lines.map((line) => {
      const orderItem = order.items?.find((item) => item.wholesaleLineId === line.line_id);
      const catalogProduct = props.s.products.find((product) => product.id === orderItem?.productId);
      return <WholesaleLineEditor key={line.line_id} line={line} snapshot={snapshot} displayModel={catalogProduct?.name || naturalCaseName(line.model)} displayVariant={catalogProduct?.variant || naturalCaseName(line.variant)} refresh={props.refresh} notify={props.notify} initialEditing={editingLineId === line.line_id} />;
    })}</div>
    <div className="form-actions"><button className="secondary" onClick={() => exportWholesalePdf(orderName(order), lines, snapshot, currency)}>Descargar PDF</button><button className="text-button" onClick={() => props.go(`/clientes/base?cliente=${encodeURIComponent(order.customerId)}`)}>Ver cliente</button></div>
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
  const selectedOrder = props.s.orders.find((order) => order.source === "wholesale" && order.items?.some((item) => item.wholesaleLineId === selected));
  const historyFilters = history ? <details className="wholesale-compact-filters is-orders wholesale-history-filters"><summary aria-label="Filtros y orden" title="Filtros y orden"><Funnel size={19} aria-hidden="true" /></summary><div className="wholesale-compact-filters-panel"><label>Cliente<select aria-label="Filtrar cliente en histórico mayorista" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value="">Todos</option>{customers.map((option) => <option key={option} value={option}>{displayCustomer(option)}</option>)}</select></label><label>Modelo<select aria-label="Filtrar modelo en histórico mayorista" value={modelFilter} onChange={(event) => setModelFilter(event.target.value)}><option value="">Todos</option>{models.map((option) => <option key={option} value={option}>{displayNames(baseLines.find((line) => line.model === option)!).model}</option>)}</select></label><label>Ordenar<select aria-label="Ordenar histórico mayorista" value={`${sort.key}:${sort.direction}`} onChange={(event) => { const [key, direction] = event.target.value.split(":") as [typeof sort.key, typeof sort.direction]; setSort({ key, direction }); }}><option value="fecha:desc">Fecha: más recientes</option><option value="fecha:asc">Fecha: más antiguos</option><option value="cantidad:desc">Cantidad: mayor a menor</option><option value="cantidad:asc">Cantidad: menor a mayor</option><option value="total:desc">Total: mayor a menor</option><option value="total:asc">Total: menor a mayor</option></select></label></div></details> : undefined;
  return <section className="wholesale-production">
    <Stats items={[{ label: history ? "Líneas terminadas" : "Líneas activas", value: summaryLines.length }, { label: "Unidades", value: summaryLines.reduce((sum, line) => sum + Number(line.quantity), 0) }, { label: "Pedidos", value: new Set(summaryLines.map((line) => line.order_id || line.line_id)).size }]} />
    <div className="wholesale-production-actions"><label className="wholesale-currency-picker">Moneda<select aria-label="Moneda mayorista" value={currency} onChange={(event) => setCurrency(event.target.value as WholesaleCurrency)}><option value="UYU">UYU · pesos uruguayos</option><option value="ARS">ARS · pesos argentinos</option></select></label>
      <div className="table-actions"><button className="secondary wholesale-export-button" disabled={!lines.length} onClick={() => exportWholesaleXlsx(lines, snapshot, currency)}>Excel</button><button className="secondary wholesale-export-button" disabled={!lines.length} onClick={() => exportWholesalePdf(history ? "Histórico mayorista" : "Producción mayorista", lines, snapshot, currency)}>PDF</button><button className="secondary wholesale-export-button" disabled={!lines.length} onClick={() => exportWholesaleCsv(lines, snapshot, currency)}>CSV</button></div></div>
    {!history && <div className="wholesale-production-viewbar"><div className="tabs inner-tabs">{["Pedidos", "Modelo", "Variante", "Virolas", "Cuero Torpedo"].map((value) => <button key={value} className={group === value ? "active" : ""} onClick={() => { setGroup(value); setSort({ key: "fecha", direction: "desc" }); }}>{value}</button>)}</div><div className="wholesale-production-view-actions"><button type="button" className="wholesale-icon-button wholesale-clear-filters" aria-label="Quitar filtros" title="Quitar filtros" disabled={!hasFilters} onClick={clearFilters}><FunnelX size={19} aria-hidden="true" /></button><details className={`wholesale-compact-filters${group === "Pedidos" ? " is-orders" : ""}`}><summary aria-label="Filtros y orden" title="Filtros y orden"><Funnel size={19} aria-hidden="true" /></summary><div className="wholesale-compact-filters-panel"><label>Cliente<select aria-label="Filtrar cliente en vista compacta" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value="">Todos</option>{customers.map((option) => <option key={option} value={option}>{displayCustomer(option)}</option>)}</select></label><label>Modelo<select aria-label="Filtrar modelo en vista compacta" value={modelFilter} onChange={(event) => setModelFilter(event.target.value)}><option value="">Todos</option>{models.map((option) => <option key={option} value={option}>{displayNames(baseLines.find((line) => line.model === option)!).model}</option>)}</select></label><label>Ordenar<select aria-label="Ordenar en vista compacta" value={`${sort.key}:${sort.direction}`} onChange={(event) => { const [key, direction] = event.target.value.split(":") as [typeof sort.key, typeof sort.direction]; setSort({ key, direction }); }}><option value="fecha:desc">Fecha: más recientes</option><option value="fecha:asc">Fecha: más antiguos</option><option value="cantidad:desc">Cantidad: mayor a menor</option><option value="cantidad:asc">Cantidad: menor a mayor</option><option value="total:desc">Total: mayor a menor</option><option value="total:asc">Total: menor a mayor</option></select></label></div></details><label className="search"><MagnifyingGlass size={18} aria-hidden="true" /><input aria-label="Buscar en producción mayorista" placeholder="Buscar…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div></div>}
    {actionError && <div className="error" role="alert">{actionError}</div>}
    {group === "Pedidos" || history ? <Table rows={lines.map((line) => ({ ...line, id: line.line_id }))} showSearch={history} action={historyFilters} className={`wholesale-production-table wholesale-production-orders-table${history ? " wholesale-production-history-table" : ""}`} searchQuery={history ? undefined : search} onSearchQueryChange={history ? undefined : setSearch} searchText={(line) => { const names = displayNames(line); return `${line.order_id || line.line_id} ${displayCustomer(line.customer)} ${names.model} ${names.variant}`; }} columns={[
      { label: "Pedido", render: (line) => <button className="text-button" onClick={() => openLine(line.line_id)}>{line.order_id || `Línea ${line.line_id}`}</button> },
      { label: "Cliente", header: customerHeader, render: (line) => displayCustomer(line.customer) },
      { label: "Modelo", header: modelHeader, render: (line) => displayNames(line).model },
      { label: "Variante", render: (line) => displayNames(line).variant },
      { label: "Cantidad", header: sortHeader("Cantidad", "cantidad"), sortDirection: sort.key === "cantidad" ? sort.direction === "desc" ? "descending" : "ascending" : "none", render: (line) => line.quantity },
      { label: "Estado", render: (line) => <Badge tone={wholesaleStatusTone(line.status)}>{line.status}</Badge> },
      { label: history ? "Completado" : "Fecha", header: sortHeader("Fecha", "fecha"), sortDirection: sort.key === "fecha" ? sort.direction === "desc" ? "descending" : "ascending" : "none", render: (line) => (history ? line.completed_at : line.created_at)?.slice(0, 10) || "—" },
      { label: "Total", header: sortHeader(`Total ${currency}`, "total"), sortDirection: sort.key === "total" ? sort.direction === "desc" ? "descending" : "ascending" : "none", render: (line) => <span className="wholesale-amount">{wholesaleMoney(valueFor(line), currency)}</span> },
      { label: "Acciones", render: (line) => <div className="wholesale-row-actions">{history ? <button type="button" className="wholesale-icon-button" aria-label={`Ver ${line.order_id || line.line_id}`} title="Ver detalle" onClick={() => openLine(line.line_id)}><Eye size={19} aria-hidden="true" /></button> : <><button type="button" className="wholesale-icon-button wholesale-complete-action" aria-label={`Completar ${line.order_id || line.line_id}`} title="Completar" disabled={Boolean(busyLineId)} onClick={() => void completeLine(line)}><Check size={20} weight="bold" aria-hidden="true" /></button><button type="button" className="wholesale-icon-button" aria-label={`Editar ${line.order_id || line.line_id}`} title="Editar" onClick={() => openLine(line.line_id, true)}><PencilSimple size={19} aria-hidden="true" /></button></>}</div> },
    ]} /> : group === "Virolas" && !summaries.length ? <div className="empty" role="status">No hay tipos de virola registrados en los productos de pedidos activos.</div> : <Table rows={summaries} showSearch={false} className={`wholesale-production-table${group === "Variante" ? " wholesale-variant-summary-table" : ""}`} searchQuery={search} onSearchQueryChange={setSearch} searchText={(row) => row.name} columns={summaryColumns} />}
    {selectedOrder && <WholesaleOrderModal key={`${selectedOrder.id}:${editingLineId || "view"}`} order={selectedOrder} props={props} onClose={() => { setSelected(null); setEditingLineId(null); }} currency={currency} editingLineId={editingLineId} />}
  </section>;
}
