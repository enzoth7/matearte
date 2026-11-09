import { useState, type FormEvent } from "react";
import { Trash } from "@phosphor-icons/react";
import { commerceSource } from "./commerceSource";
import { joinCustomerPhone, splitCustomerPhone } from "./customerPhone";
import { currencyMoney, type Customer, type Order, type Product } from "./data";
import { salePriceMinor } from "./localSalePricing";
import { Modal } from "./ui";

const internalChannels = ["Local", "Feria", "WhatsApp", "Instagram", "Facebook"];

/** Solo las ventas registradas por el equipo (no Web ni Mayorista) se pueden corregir o eliminar. */
export const canEditLocalSale = (order: Order) => order.source === "local" && !!commerceSource && internalChannels.includes(order.channel);

type LineDraft = { id: string; name: string; sku: string; quantity: string; price: string; notes: string; service: boolean; personalized: boolean; assemblySummary?: string; isNew?: boolean; variablePrice?: boolean; priceOverridden?: boolean };

const errorText = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación.";
const normalizeCustomerName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
const phoneSearchVariants = (value: string, country: string) => {
  const { prefix, number } = splitCustomerPhone(value, country);
  return [value.replace(/\D/g, ""), number.replace(/\D/g, ""), joinCustomerPhone(prefix, number).replace(/\D/g, "")].filter(Boolean);
};
const customerLabel = (customer: Customer) => `${customer.name} | ${splitCustomerPhone(customer.phone, customer.country).number || "Sin celular"}`;

export function LocalSaleEditor({ order, customers, products, depositAmount, onClose, onChanged }: {
  order: Order; customers: Customer[]; products: Product[]; depositAmount?: number; onClose: () => void; onChanged: (message: string) => Promise<void> | void;
}) {
  const localCustomers = customers.filter((customer) => customer.localCustomerId).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const [customerId, setCustomerId] = useState(customers.find((customer) => customer.id === order.customerId)?.localCustomerId || "");
  const [customerSearch, setCustomerSearch] = useState("");
  const selectedCustomer = localCustomers.find((customer) => customer.localCustomerId === customerId);
  const customerMatches = customerSearch.trim() ? localCustomers.filter((customer) => {
    const query = customerSearch.trim();
    if (normalizeCustomerName(customer.name).includes(normalizeCustomerName(query))) return true;
    if (!/^[\d\s()+.-]+$/.test(query)) return false;
    const queryVariants = phoneSearchVariants(query, customer.country || "");
    return [customer.phone, ...(customer.agendaAdditionalPhones || [])].some((phone) => {
      const variants = phoneSearchVariants(phone, customer.country || "");
      return queryVariants.some((needle) => variants.some((number) => number.includes(needle)));
    });
  }).slice(0, 30) : [];
  const payment = order.paymentMethod || "Efectivo";
  const originalPaid = order.originalDepositAmount ?? order.originalTotalAmount ?? order.depositAmount ?? depositAmount ?? order.totalAmount ?? 0;
  const shippingMinor = Math.round((order.originalShippingAmount ?? 0) * 100);
  const saleMoney = (amount: number) => currencyMoney(amount, order.originalCurrency);
  const hasDeposit = order.depositAmount != null || order.paymentMethod === "Seña";
  const [lines, setLines] = useState<LineDraft[]>((order.items || []).map((item) => ({
    id: item.id, name: item.productName || item.title, sku: item.sku, quantity: String(item.quantity), price: String(item.originalUnitPrice ?? item.unitPrice),
    notes: item.productionNotes || "", service: item.family === "Servicios", personalized: Boolean(item.personalization),
    assemblySummary: item.personalization?.assembly ? item.variant : undefined,
  })));
  const [skuInput, setSkuInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const minor = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
  const itemsMinor = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (minor(line.price) || 0), 0);
  const catalogPrice = (product: Product) => Math.round(salePriceMinor(product, payment === "Cuenta corriente" ? "Efectivo" : payment) / (order.retailRateToUyu ?? 1)) / 100;
  const patch = (id: string, changes: Partial<LineDraft>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line));
  const skuProduct = products.find((product) => product.sku.trim().toUpperCase() === skuInput.trim().toUpperCase()
    && !product.wholesaleProductId && product.availableChannels?.includes("Local")
    && (order.channel === "Local" || product.categoryCode !== "servicios"));
  const addSku = () => {
    if (!skuInput.trim()) { setError("Ingresá el SKU del artículo."); return; }
    if (!skuProduct) { setError("No encontramos un artículo disponible con ese SKU."); return; }
    const service = skuProduct.categoryCode === "servicios";
    setLines((current) => [...current, {
      id: crypto.randomUUID(), name: skuProduct.name, sku: skuProduct.sku, quantity: "1",
      price: String(catalogPrice(skuProduct)), notes: "", service, personalized: false,
      isNew: true, variablePrice: service && skuProduct.prices.Local === 0,
    }]);
    setSkuInput(""); setError("");
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!commerceSource || busy) return;
    if (!lines.length) { setError("La venta debe conservar al menos un producto."); return; }
    if (lines.some((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1 || !Number.isInteger(minor(line.price)) || minor(line.price) < 0 || (line.variablePrice && minor(line.price) <= 0))) { setError("Revisá cantidades y precios."); return; }
    if (skuInput.trim()) { setError("Agregá el SKU ingresado antes de guardar."); return; }
    const totalMinor = itemsMinor + shippingMinor;
    if (hasDeposit ? Math.round(originalPaid * 100) > totalMinor : Math.round(originalPaid * 100) !== totalMinor) {
      setError(hasDeposit ? "El total de la venta no puede ser menor que lo cobrado originalmente." : "Una venta ya cobrada debe conservar el mismo total. Revisá los artículos o registrá una venta nueva."); return;
    }
    setBusy(true); setError("");
    const { error: failure } = await commerceSource.rpc("gestion_update_local_sale", {
      p_sale_id: order.id, p_customer_id: customerId || null, p_sold_on: order.date, p_payment_method: payment,
      p_deposit_minor: order.depositAmount != null ? Math.round((order.originalDepositAmount ?? order.depositAmount) * 100) : null,
      p_items: lines.map((line) => ({ ...(line.isNew ? { sku: line.sku } : { id: line.id }), quantity: Number(line.quantity), unit_price_minor: minor(line.price), ...(line.service && line.notes.trim() ? { production_notes: line.notes.trim() } : {}) })),
    });
    setBusy(false);
    if (failure) { setError(failure.message || "No se pudieron guardar los cambios."); return; }
    await onChanged("Venta actualizada");
  }

  return <Modal title="Editar venta" className="local-sale-editor-modal" onClose={onClose}>
    <form className="local-sale-editor" onSubmit={(event) => void save(event)}>
      <div className="form-grid">
        <div className="local-sale-original-date"><small>Fecha de venta</small><strong>{order.date.split("-").reverse().join("/")}</strong></div>
        <div className="local-sale-original-date"><small>{payment === "Cuenta corriente" ? "Modalidad" : "Medio del cobro inicial"}</small><strong>{payment === "Cuenta corriente" ? "Fiado" : payment}</strong></div>
        <div className="local-sale-original-date"><small>{payment === "Cuenta corriente" ? "Cobro inicial" : hasDeposit ? "Seña original" : "Cobro inicial"}</small><strong>{saleMoney(originalPaid)}</strong></div>
        <div className="wide local-sale-editor-customer-fields">
          <div className="local-sale-editor-customer-search">
            <label htmlFor="local-sale-editor-customer-search">Buscar cliente por nombre o celular</label>
            <input id="local-sale-editor-customer-search" type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Nombre o celular" autoComplete="off" />
            {customerSearch.trim() && <div className="local-sale-editor-customer-results" aria-label="Coincidencias de clientes">
              {customerMatches.map((customer) => <button type="button" key={customer.id} onClick={() => { setCustomerId(customer.localCustomerId || ""); setCustomerSearch(""); }}>
                {customerLabel(customer)}
              </button>)}
              {!customerMatches.length && <small>No encontramos clientes.</small>}
            </div>}
          </div>
          <div className="local-sale-editor-customer-selection">
            <small>Cliente de la venta</small>
            <div className="local-sale-editor-customer-value" aria-live="polite">
              <output>{selectedCustomer ? customerLabel(selectedCustomer) : "Cliente sin registrar"}</output>
              {selectedCustomer && <button type="button" onClick={() => setCustomerId("")} aria-label="Quitar cliente de la venta">Quitar</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="local-sale-editor-add">
        <label>Agregar artículo por SKU<input value={skuInput} onChange={(event) => { setSkuInput(event.target.value); setError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSku(); } }} placeholder="Ingresá el SKU exacto" autoComplete="off" /></label>
        <button type="button" className="secondary" onClick={addSku} disabled={busy}>Agregar</button>
        {skuInput.trim() && skuProduct && <small>{skuProduct.name}, {saleMoney(catalogPrice(skuProduct))}</small>}
      </div>
      <div className="local-sale-editor-lines">
        {lines.map((line) => <div className="local-sale-editor-line" key={line.id}>
          <div className="local-sale-editor-name"><strong>{line.name}</strong><small>{[line.sku, line.personalized ? "Personalizado" : ""].filter(Boolean).join(", ")}</small>{line.assemblySummary && <small>{line.assemblySummary}</small>}</div>
          <label>Cantidad<input type="number" min="1" max="1000" step="1" value={line.quantity} onChange={(event) => patch(line.id, { quantity: event.target.value })} /></label>
          <label>{order.retailRateToUyu ? `Precio unitario (${order.originalCurrency})` : "Precio unitario"}<input type="number" min={line.variablePrice ? "0.01" : "0"} step="0.01" value={line.price} onChange={(event) => patch(line.id, { price: event.target.value, priceOverridden: true })} /></label>
          <button type="button" className="local-sale-remove" aria-label={`Quitar ${line.name}`} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash size={18} /></button>
          {line.service && <label className="local-sale-line-notes">Notas para producción<textarea maxLength={1000} rows={2} value={line.notes} onChange={(event) => patch(line.id, { notes: event.target.value })} /></label>}
        </div>)}
      </div>
      {shippingMinor > 0 && <div className="local-sale-editor-total">Envío <strong>{saleMoney(shippingMinor / 100)}</strong></div>}
      <div className="local-sale-editor-total">Total de la venta <strong>{saleMoney((itemsMinor + shippingMinor) / 100)}</strong></div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </form>
  </Modal>;
}

export async function deleteLocalSale(order: Order): Promise<string | null> {
  if (!commerceSource) return "No hay conexión con la base.";
  if (!window.confirm(`¿Eliminar definitivamente la venta ${order.referenceCode || ""}? Esta acción no se puede deshacer.`.replace("  ", " "))) return null;
  const { error } = await commerceSource.rpc("gestion_delete_local_sale", { p_sale_id: order.id });
  return error ? errorText(new Error(error.message)) : "";
}
