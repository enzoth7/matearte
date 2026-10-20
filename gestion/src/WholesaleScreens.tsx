import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowDown, ArrowUp, CaretDown, Check, Eye, FunnelX, MagnifyingGlass, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import type { PageProps } from "./pages";
import type { Customer, Order } from "./data";
import { money, orderName, paid, balance, total } from "./data";
import { Badge, Modal, Stats, Table, type Column } from "./ui";
import { createWholesaleOrder, deleteWholesaleCustomer, countWholesaleCustomerLines, deleteWholesaleLine, completeWholesaleLine, nextWholesaleProductId, saveWholesaleCustomer, saveWholesaleProduct, updateWholesaleLine, uploadWholesaleProductImages, deleteWholesaleProductImage, saveWholesaleProductImageCrop, saveWholesaleProductImageColor, moveWholesaleProductImage, setWholesaleProductImageCover, wholesaleProductImageUrl, type WholesaleCustomer, type WholesaleLine, type WholesaleProduct, type WholesaleProductImage, type WholesaleSnapshot } from "./wholesaleSource";
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
import { catalogValueLabel, defaultCatalogTaxonomy, normalizeCatalogValueMap, taxonomyOptionsFor, type CatalogMaterialId, type CatalogTaxonomy } from "../../shared/catalog-taxonomy";
import { naturalCaseName } from "./productionPresentation";
import { wholesaleSaleCategory, wholesaleSaleCategoryLabel, wholesaleSaleType, wholesaleSaleVariantLabel } from "./wholesaleSaleSelection";

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
  const [items, setItems] = useState([{ key: crypto.randomUUID(), category: "", model: "", productId: "", quantity: 1, noCost: false }]);
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
      if (target) return current.map((row) => row.key === target.key ? { ...row, category: wholesaleSaleCategory(product) || "", model: wholesaleSaleType(product), productId: String(product.id) } : row);
      return [...current, { key: crypto.randomUUID(), category: wholesaleSaleCategory(product) || "", model: wholesaleSaleType(product), productId: String(product.id), quantity: 1, noCost: false }];
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
        <button type="button" className="secondary" onClick={() => setItems((current) => [...current, { key: crypto.randomUUID(), category: "", model: "", productId: "", quantity: 1, noCost: false }])}><Plus size={18} aria-hidden="true" />Agregar artículo</button>
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
          <label className="wholesale-sale-cell"><span>Categoría</span><select required aria-label={`Categoría ${index + 1}`} value={item.category} onChange={(event) => setItems(items.map((row) => row.key === item.key ? { ...row, category: event.target.value, model: "", productId: "" } : row))}><option value="">Elegir</option><option value="mates">Mates</option><option value="materas">Materas</option><option value="bombillas">Bombillas</option><option value="bombillones">Bombillones</option></select></label>
          <label className="wholesale-sale-cell"><span>{typeLabel}</span><select required aria-label={`Tipo ${index + 1}`} value={item.model} disabled={!item.category} onChange={(event) => setItems(items.map((row) => row.key === item.key ? { ...row, model: event.target.value, productId: "" } : row))}><option value="">{item.category ? `Elegir ${typeLabel.toLocaleLowerCase("es")}` : "Elegir tipo"}</option>{models.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
          <label className="wholesale-sale-cell"><span>Nombre y variante</span><select required aria-label={`Nombre y variante ${index + 1}`} value={item.productId} disabled={!item.model} onChange={(event) => setItems(items.map((row) => row.key === item.key ? { ...row, productId: event.target.value } : row))}><option value="">Elegir nombre y variante</option>{variants.map((product) => <option key={product.id} value={product.id}>{wholesaleSaleVariantLabel(product)}</option>)}</select></label>
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
      <small className="wholesale-sale-note">El pedido se guardará en el tablero de producción mayorista con su número PED-.</small>
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

const wholesaleImageCrop = (image: WholesaleProductImage): ProductCoverCrop => ({
  x: Number(image.option_values?.cover_x) || 0,
  y: Number(image.option_values?.cover_y) || 0,
  zoom: Number(image.option_values?.cover_zoom) || 1,
});

export function WholesaleProductEditor({ product, snapshot, onSaved, onClose, onRefresh, onNotice, onDirtyChange }: { product?: WholesaleProduct; snapshot: WholesaleSnapshot; onSaved: (id: string) => void; onClose: () => void; onRefresh?: () => Promise<void>; onNotice: (message: string) => void; onDirtyChange?: (dirty: boolean) => void }) {
  const [model, setModel] = useState(product?.model || "");
  const [variant, setVariant] = useState(product?.variant || "");
  const [price, setPrice] = useState(String(product?.price_arg ?? ""));
  const [category, setCategory] = useState(product?.category_code || "");
  const [description, setDescription] = useState(product?.description || "");
  const [sku, setSku] = useState(product?.sku || "");
  const [weight, setWeight] = useState(product?.weight_grams == null ? "" : String(product.weight_grams));
  const [availableLocal, setAvailableLocal] = useState(product?.available_local === true);
  const [availableWeb, setAvailableWeb] = useState(product?.available_web === true);
  const [available, setAvailable] = useState(product?.available_wholesale !== false);
  const [catalogAttributes, setCatalogAttributes] = useState(() => {
    const values = normalizeCatalogValueMap(product?.catalog_attributes);
    if (!values["tipo-mate"]) values["tipo-mate"] = mateModelCode(product?.model || "", product?.category_code) || "";
    if (!values["tipo-virola"] && product?.rim_type) values["tipo-virola"] = mateRimCode(product.rim_type);
    if (!values["tipo-cuero"] && product?.leather_type) values["tipo-cuero"] = mateLeatherCode(product.leather_type);
    return values;
  });
  const [materials, setMaterials] = useState<CatalogMaterialId[]>(() => { const attributes = product?.catalog_attributes; const value = attributes?.materials; return Array.isArray(value) ? value.filter((item): item is CatalogMaterialId => typeof item === "string") : typeof attributes?.material === "string" ? [attributes.material as CatalogMaterialId] : []; });
  const [taxonomy, setTaxonomy] = useState<CatalogTaxonomy>(defaultCatalogTaxonomy);
  useEffect(() => { void loadCatalogTaxonomy(false).then(value => { if (value.rules.length && value.attributes.length) setTaxonomy(value); }).catch(() => { /* El catálogo local sigue disponible. */ }); }, []);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageTargets, setImageTargets] = useState<Record<string, string>>({});
  const [coverEditorImage, setCoverEditorImage] = useState<WholesaleProductImage | null>(null);
  const [error, setError] = useState("");
  const images = snapshot.images.filter(image => image.product_id === product?.id).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!product || !files.length) return;
    const invalid = files.find(file => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024);
    if (invalid) { setError(`“${invalid.name}” debe ser PNG, JPEG o WebP de hasta 10 MB.`); return; }
    setImageBusy(true); setError("");
    try {
      const count = await uploadWholesaleProductImages(product.id, files, Math.max(-1, ...images.map(image => image.sort_order)) + 1, `Foto de ${product.model} · ${product.variant}`);
      await onRefresh?.();
      onNotice(count === 1 ? "Foto mayorista subida." : `${count} fotos mayoristas subidas.`);
    } catch (failure) { setError(errorText(failure)); try { await onRefresh?.(); } catch { /* El error original queda visible. */ } }
    finally { setImageBusy(false); }
  }
  async function changeImage(action: "cover" | "delete", image: WholesaleProductImage) {
    if (action === "delete" && !window.confirm(`¿Eliminar “${image.original_name}”?`)) return;
    setImageBusy(true); setError("");
    try {
      if (action === "cover") await setWholesaleProductImageCover(image, images[0].sort_order);
      else await deleteWholesaleProductImage(image);
      await onRefresh?.();
      onNotice(action === "cover" ? "Foto principal actualizada." : "Foto eliminada.");
    } catch (failure) { setError(errorText(failure)); try { await onRefresh?.(); } catch { /* El error original queda visible. */ } }
    finally { setImageBusy(false); }
  }
  async function saveCrop(crop: ProductCoverCrop) {
    if (!coverEditorImage) return;
    setImageBusy(true); setError("");
    try {
      await saveWholesaleProductImageCrop(coverEditorImage, crop);
      setCoverEditorImage(null);
      await onRefresh?.();
      onNotice("Encuadre guardado.");
    } catch (failure) { setError(errorText(failure)); }
    finally { setImageBusy(false); }
  }
  async function changeImageColor(image: WholesaleProductImage, color: string) {
    setImageBusy(true); setError("");
    try {
      await saveWholesaleProductImageColor(image, color);
      await onRefresh?.();
      onNotice(color ? "Color enlazado a la foto." : "Foto marcada como general.");
    } catch (failure) { setError(errorText(failure)); }
    finally { setImageBusy(false); }
  }
  async function moveImage(image: WholesaleProductImage) {
    const target = snapshot.products.find(item => item.id === imageTargets[image.id]);
    if (!target) { setError("Elegí a qué producto querés mover la foto."); return; }
    const nextOrder = Math.max(-1, ...snapshot.images.filter(item => item.product_id === target.id).map(item => item.sort_order)) + 1;
    setImageBusy(true); setError("");
    try {
      const needsCleanup = await moveWholesaleProductImage(image, target, nextOrder);
      setImageTargets(current => { const next = { ...current }; delete next[image.id]; return next; });
      await onRefresh?.();
      onNotice(needsCleanup ? `Foto movida a “${productLabel(target)}”. El archivo anterior requiere limpieza manual.` : `Foto movida a “${productLabel(target)}”.`);
    } catch (failure) { setError(errorText(failure)); try { await onRefresh?.(); } catch { /* El error original queda visible. */ } }
    finally { setImageBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (isMateCategory(category) && (!catalogAttributes["tipo-virola"] || !catalogAttributes["tipo-cuero"] || !catalogAttributes.posamate)) throw new Error("Elegí el tipo de virola, el tipo de cuero y el posamate.");
      if (isMateCategory(category) && !catalogAttributes["material-mate"]) throw new Error("Elegí el material del mate.");
      const id = product?.id || await nextWholesaleProductId();
      const rim = catalogAttributes["tipo-virola"] ? catalogValueLabel(taxonomy, "tipo-virola", catalogAttributes["tipo-virola"]) : "";
      const leather = catalogAttributes["tipo-cuero"] ? catalogValueLabel(taxonomy, "tipo-cuero", catalogAttributes["tipo-cuero"]) : "";
      await saveWholesaleProduct({ id, model, variant, rim_type: rim, leather_type: leather, price_arg: Number(price), price_uyu: Number(price) * snapshot.exchangeRate, category_code: category || null, description, sku: sku || null, weight_grams: weight === "" ? null : Number(weight), available_local: availableLocal, available_web: availableWeb, available_wholesale: available, catalog_attributes: { ...catalogAttributes, materials } }, product?.id);
      onDirtyChange?.(false);
      onSaved(id);
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  return <section className="catalog-workspace catalog-workspace-embedded wholesale-catalog-workspace"><div className="panel">
    <div className="panel-head"><div><h3>{product ? productLabel(product) : "Nuevo producto"}</h3></div><div className="product-actions"><button type="button" className="catalog-close-button" onClick={onClose} aria-label="Cerrar ficha" title="Cerrar ficha"><X size={20} aria-hidden="true" /></button></div></div>
    <form className="catalog-product-editor-form" onChangeCapture={() => onDirtyChange?.(true)} onSubmit={(event) => void submit(event)}>
    <details className="catalog-editor-section" open><summary>Datos del producto</summary>
      <div className="product-details">
        <div className="product-fields">
          <label><span className="field-label">Nombre *</span><input required maxLength={160} value={model} onChange={event => { const next = event.target.value; setCatalogAttributes(current => current["tipo-mate"] && current["tipo-mate"] !== mateModelCode(model, category) ? current : { ...current, "tipo-mate": mateModelCode(next, category) }); setModel(next); }} /></label>
          <CatalogProductCoreFields category={category} categories={snapshot.categories.filter(item => item.active || item.code === category).map(item => ({code:item.code,label:item.label_es}))} saleMode={String(catalogAttributes.sale_mode || "standard")} weight={weight} description={description} onCategoryChange={next => { setCategory(next); if (!catalogAttributes["tipo-mate"]) setCatalogAttributes(current => ({ ...current, "tipo-mate": mateModelCode(model, next) })); }} onSaleModeChange={sale_mode => setCatalogAttributes(current => ({ ...current, sale_mode }))} onWeightChange={setWeight} onDescriptionChange={setDescription} />
        </div>
        <DynamicAttributeFields taxonomy={taxonomy} category={category} scope="product" values={catalogAttributes} onChange={setCatalogAttributes} materials={materials} onMaterialsChange={next => { setMaterials(next); setCatalogAttributes(current => { const updated = { ...current }; if (next.length) updated.material = next[0]; else delete updated.material; return updated; }); }} />
        {error && <div className="error" role="alert">{error}</div>}
      </div>
    </details>
    <details className="catalog-editor-section" open><summary>Imágenes del producto</summary>
      <section className="image-manager">
        <input id={`wholesale-images-${product?.id || "new"}`} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={imageBusy || !product} onChange={event => void upload(event)} />
        <div className="image-manager-head"><div>PNG, JPEG o WebP · Hasta 10 MB.</div>{product && images.length > 0 && <label className={`upload-button ${imageBusy ? "disabled" : ""}`} htmlFor={`wholesale-images-${product.id}`}>Subir imágenes</label>}</div>
        {!product ? <div className="image-empty">Guardá el producto para poder agregar fotos.</div> : images.length ? <div className="image-gallery">{images.map((image, index) => <figure className="product-image" key={image.id}>
          <div className="product-image-preview"><img src={wholesaleProductImageUrl(image.storage_path)} alt={image.alt_text || product.model} loading="lazy" style={{ objectPosition: `${50 - wholesaleImageCrop(image).x}% ${50 - wholesaleImageCrop(image).y}%`, transform: `scale(${wholesaleImageCrop(image).zoom})` }} /></div>
          <figcaption><div className="image-meta"><strong>{index === 0 ? "Principal" : `Imagen ${index + 1}`}</strong><div title={image.original_name}>{image.original_name}</div></div><div className="image-card-actions">
            <button type="button" className="image-cover" disabled={imageBusy} onClick={() => setCoverEditorImage(image)}>Ajustar encuadre</button>
            {index > 0 && <button type="button" className="image-move" disabled={imageBusy} onClick={() => void changeImage("cover", image)}>Hacer principal</button>}
            <select className="image-variant-select" value={typeof image.option_values?.color === "string" ? image.option_values.color : ""} disabled={imageBusy} onChange={event => void changeImageColor(image, event.target.value)} aria-label={`Color para ${image.original_name}`}>
              <option value="">General (todos los colores)</option>
              {taxonomyOptionsFor(taxonomy, "color").map(color => <option key={color.code} value={color.code}>{color.label_es}</option>)}
            </select>
            <select value={imageTargets[image.id] || ""} disabled={imageBusy} onChange={event => setImageTargets(current => ({ ...current, [image.id]: event.target.value }))} aria-label={`Mover ${image.original_name} a otro producto`}>
              <option value="">Mover a…</option>
              {snapshot.products.filter(item => item.id !== product.id).sort((a, b) => productLabel(a).localeCompare(productLabel(b), "es")).map(item => <option key={item.id} value={item.id}>{productLabel(item)}</option>)}
            </select>
            <button type="button" className="image-move" disabled={imageBusy || !imageTargets[image.id]} onClick={() => void moveImage(image)}>Mover</button>
            <button type="button" className="image-delete" disabled={imageBusy} onClick={() => void changeImage("delete", image)}>Eliminar</button>
          </div></figcaption>
        </figure>)}</div> : <div className="image-empty"><strong>Todavía no hay imágenes</strong><label className="upload-button" htmlFor={`wholesale-images-${product.id}`}>Subir imágenes</label></div>}
      </section>
    </details>
    <details className="catalog-editor-section" open><summary>Precio y disponibilidad</summary><section className="variants-section wholesale-variant-section">
      <div className="catalog-variant-summary">
        <div className="product-fields">
          <label><span className="field-label">SKU</span><input maxLength={80} value={sku} onChange={event => setSku(event.target.value)} placeholder={product?.id || "Código interno"} /></label>
          <label><span className="field-label">Nombre / detalles del producto *</span><input required maxLength={160} value={variant} onChange={event => setVariant(event.target.value)} /></label>
          <label><span className="field-label">Precio ARS *</span><input required type="number" min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)} /></label>
        </div>
        <div className="wholesale-price-equivalent">Equivalente UYU <strong>{money(product && Number(price) === Number(product.price_arg) ? Number(product.price_uyu) : (Number(price) || 0) * snapshot.exchangeRate)}</strong></div>
        <CatalogVariantDetails channels={{ Local: availableLocal, Web: availableWeb, Mayorista: available }} onChannelChange={(channel, checked) => channel === "Local" ? setAvailableLocal(checked) : channel === "Web" ? setAvailableWeb(checked) : setAvailable(checked)} disabled={busy} />
        <div className="form-actions"><button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button></div>
      </div>
    </section></details>
    </form>
    {coverEditorImage && <ProductCoverEditor key={coverEditorImage.id} imageUrl={wholesaleProductImageUrl(coverEditorImage.storage_path)} imageAlt={coverEditorImage.alt_text || product?.model || "Producto mayorista"} initialCrop={wholesaleImageCrop(coverEditorImage)} busy={imageBusy} onCancel={() => setCoverEditorImage(null)} onSave={crop => void saveCrop(crop)} />}
  </div></section>;
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
      <label>Variante<select value={variant} onChange={(event) => setVariant(event.target.value)}><option value="">Seleccionar</option>{snapshot.products.filter((item) => item.model === model).map((item) => <option key={item.id} value={item.variant}>{naturalCaseName(item.variant)}</option>)}</select></label>
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
  return <section className="wholesale-production">
    <Stats items={[{ label: history ? "Líneas terminadas" : "Líneas activas", value: summaryLines.length }, { label: "Unidades", value: summaryLines.reduce((sum, line) => sum + Number(line.quantity), 0) }, { label: "Pedidos", value: new Set(summaryLines.map((line) => line.order_id || line.line_id)).size }]} />
    <div className="wholesale-production-actions"><label className="wholesale-currency-picker">Moneda<select aria-label="Moneda mayorista" value={currency} onChange={(event) => setCurrency(event.target.value as WholesaleCurrency)}><option value="UYU">UYU · pesos uruguayos</option><option value="ARS">ARS · pesos argentinos</option></select></label>
      <div className="table-actions"><button className="secondary wholesale-export-button" disabled={!lines.length} onClick={() => exportWholesaleXlsx(lines, snapshot, currency)}>Excel</button><button className="secondary wholesale-export-button" disabled={!lines.length} onClick={() => exportWholesalePdf(history ? "Histórico mayorista" : "Producción mayorista", lines, snapshot, currency)}>PDF</button><button className="secondary wholesale-export-button" disabled={!lines.length} onClick={() => exportWholesaleCsv(lines, snapshot, currency)}>CSV</button></div></div>
    {!history && <div className="wholesale-production-viewbar"><div className="tabs inner-tabs">{["Pedidos", "Modelo", "Variante", "Virolas", "Cuero Torpedo"].map((value) => <button key={value} className={group === value ? "active" : ""} onClick={() => { setGroup(value); setSort({ key: "fecha", direction: "desc" }); }}>{value}</button>)}</div><div className="wholesale-production-view-actions"><button type="button" className="wholesale-icon-button wholesale-clear-filters" aria-label="Quitar filtros" title="Quitar filtros" disabled={!hasFilters} onClick={clearFilters}><FunnelX size={19} aria-hidden="true" /></button><label className="search"><MagnifyingGlass size={18} aria-hidden="true" /><input aria-label="Buscar en producción mayorista" placeholder="Buscar…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div></div>}
    {actionError && <div className="error" role="alert">{actionError}</div>}
    {group === "Pedidos" || history ? <Table rows={lines.map((line) => ({ ...line, id: line.line_id }))} showSearch={history} className={history ? undefined : "wholesale-production-table"} searchQuery={history ? undefined : search} onSearchQueryChange={history ? undefined : setSearch} searchText={(line) => { const names = displayNames(line); return `${line.order_id || line.line_id} ${displayCustomer(line.customer)} ${names.model} ${names.variant}`; }} columns={[
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
