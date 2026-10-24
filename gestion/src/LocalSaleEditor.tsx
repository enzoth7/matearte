import { useState, type FormEvent } from "react";
import { Trash } from "@phosphor-icons/react";
import { commerceSource } from "./commerceSource";
import { money, today, type Customer, type Order, type Product } from "./data";
import { salePriceMinor } from "./localSalePricing";
import { Modal } from "./ui";

const paymentMethods = ["Efectivo", "Débito", "Crédito", "Transferencia"];
const internalChannels = ["Local", "Feria", "WhatsApp", "Instagram", "Facebook"];

/** Solo las ventas registradas por el equipo (no Web ni Mayorista) se pueden corregir o eliminar. */
export const canEditLocalSale = (order: Order) => order.source === "local" && !!commerceSource && internalChannels.includes(order.channel);

type LineDraft = { id: string; name: string; sku: string; quantity: string; price: string; notes: string; service: boolean; personalized: boolean; assemblySummary?: string; isNew?: boolean; variablePrice?: boolean; priceOverridden?: boolean };

const errorText = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación.";

export function LocalSaleEditor({ order, customers, products, depositAmount, onClose, onChanged }: {
  order: Order; customers: Customer[]; products: Product[]; depositAmount?: number; onClose: () => void; onChanged: (message: string) => Promise<void> | void;
}) {
  const localCustomers = customers.filter((customer) => customer.localCustomerId).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const [customerId, setCustomerId] = useState(customers.find((customer) => customer.id === order.customerId)?.localCustomerId || "");
  const [date, setDate] = useState(order.date);
  const [payment, setPayment] = useState(order.paymentMethod === "Seña" ? "" : order.paymentMethod || "Efectivo");
  const [hasDeposit, setHasDeposit] = useState(order.depositAmount != null || order.paymentMethod === "Seña");
  const [deposit, setDeposit] = useState(order.depositAmount == null && order.paymentMethod !== "Seña"
    ? "" : String(order.depositAmount ?? depositAmount ?? order.totalAmount ?? ""));
  const [lines, setLines] = useState<LineDraft[]>((order.items || []).map((item) => ({
    id: item.id, name: item.productName || item.title, sku: item.sku, quantity: String(item.quantity), price: String(item.unitPrice),
    notes: item.productionNotes || "", service: item.family === "Servicios", personalized: Boolean(item.personalization),
    assemblySummary: item.personalization?.assembly ? item.variant : undefined,
  })));
  const [skuInput, setSkuInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const minor = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
  const itemsMinor = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (minor(line.price) || 0), 0);
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
      price: String(salePriceMinor(skuProduct, payment) / 100), notes: "", service, personalized: false,
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
    if (!date || date > today) { setError("Revisá la fecha de venta."); return; }
    const depositMinor = minor(deposit);
    if (!payment) { setError("Elegí el medio de pago de esta venta."); return; }
    if (hasDeposit && (!Number.isInteger(depositMinor) || depositMinor <= 0 || depositMinor > itemsMinor)) { setError("La seña debe ser mayor que cero y no superar el valor de los artículos."); return; }
    setBusy(true); setError("");
    const { error: failure } = await commerceSource.rpc("gestion_update_local_sale", {
      p_sale_id: order.id, p_customer_id: customerId || null, p_sold_on: date, p_payment_method: payment,
      p_deposit_minor: hasDeposit ? depositMinor : null,
      p_items: lines.map((line) => ({ ...(line.isNew ? { sku: line.sku } : { id: line.id }), quantity: Number(line.quantity), unit_price_minor: minor(line.price), ...(line.service && line.notes.trim() ? { production_notes: line.notes.trim() } : {}) })),
    });
    setBusy(false);
    if (failure) { setError(failure.message || "No se pudieron guardar los cambios."); return; }
    await onChanged("Venta actualizada");
  }

  return <Modal title="Editar venta" className="local-sale-editor-modal" onClose={onClose}>
    <form className="local-sale-editor" onSubmit={(event) => void save(event)}>
      <div className="form-grid">
        <label>Fecha<input type="date" required max={today} value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Forma de pago<select value={payment} onChange={(event) => { const next = event.target.value; setPayment(next); setLines(current => current.map(line => {
          if (!line.isNew || line.priceOverridden) return line;
          const product = products.find(item => item.sku === line.sku);
          return product ? { ...line, price: String(salePriceMinor(product, next) / 100) } : line;
        })); }} required>{!payment && <option value="">Elegir medio de pago</option>}{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
        <label className="local-sale-deposit-toggle"><input type="checkbox" checked={hasDeposit} onChange={(event) => setHasDeposit(event.target.checked)} />Con seña</label>
        {hasDeposit && <label>Seña cobrada (UYU)<input type="number" min="0.01" step="0.01" value={deposit} onChange={(event) => setDeposit(event.target.value)} required /></label>}
        <label className="wide">Cliente<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Cliente sin registrar</option>{localCustomers.map((customer) => <option key={customer.id} value={customer.localCustomerId}>{customer.name}</option>)}</select></label>
      </div>
      <div className="local-sale-editor-add">
        <label>Agregar artículo por SKU<input value={skuInput} onChange={(event) => { setSkuInput(event.target.value); setError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSku(); } }} placeholder="Ingresá el SKU exacto" autoComplete="off" /></label>
        <button type="button" className="secondary" onClick={addSku} disabled={busy}>Agregar</button>
        {skuInput.trim() && skuProduct && <small>{skuProduct.name} · {money(salePriceMinor(skuProduct, payment) / 100)}</small>}
      </div>
      <div className="local-sale-editor-lines">
        {lines.map((line) => <div className="local-sale-editor-line" key={line.id}>
          <div className="local-sale-editor-name"><strong>{line.name}</strong><small>{[line.sku, line.personalized ? "Personalizado" : ""].filter(Boolean).join(" · ")}</small>{line.assemblySummary && <small>{line.assemblySummary}</small>}</div>
          <label>Cantidad<input type="number" min="1" max="1000" step="1" value={line.quantity} onChange={(event) => patch(line.id, { quantity: event.target.value })} /></label>
          <label>Precio unitario<input type="number" min={line.variablePrice ? "0.01" : "0"} step="0.01" value={line.price} onChange={(event) => patch(line.id, { price: event.target.value, priceOverridden: true })} /></label>
          <button type="button" className="local-sale-remove" aria-label={`Quitar ${line.name}`} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash size={18} /></button>
          {line.service && <label className="local-sale-line-notes">Notas para producción<textarea maxLength={1000} rows={2} value={line.notes} onChange={(event) => patch(line.id, { notes: event.target.value })} /></label>}
        </div>)}
      </div>
      <p className="local-sale-editor-total">Total de artículos: <strong>{money(itemsMinor / 100)}</strong>{hasDeposit ? ` · Seña: ${money((minor(deposit) || 0) / 100)}` : ""}</p>
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
