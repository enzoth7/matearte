import { useState, type FormEvent } from "react";
import { Trash } from "@phosphor-icons/react";
import { commerceSource } from "./commerceSource";
import { money, today, type Customer, type Order } from "./data";
import { Modal } from "./ui";

const paymentMethods = ["Efectivo", "Débito", "Crédito", "Transferencia", "Seña"];
const internalChannels = ["Local", "Feria", "WhatsApp", "Instagram", "Facebook"];

/** Solo las ventas registradas por el equipo (no Web ni Mayorista) se pueden corregir o eliminar. */
export const canEditLocalSale = (order: Order) => order.source === "local" && !!commerceSource && internalChannels.includes(order.channel);

type LineDraft = { id: string; name: string; sku: string; quantity: string; price: string; notes: string; service: boolean; personalized: boolean; assemblySummary?: string };

const errorText = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación.";

export function LocalSaleEditor({ order, customers, depositAmount, onClose, onChanged }: {
  order: Order; customers: Customer[]; depositAmount?: number; onClose: () => void; onChanged: (message: string) => Promise<void> | void;
}) {
  const localCustomers = customers.filter((customer) => customer.localCustomerId).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const [customerId, setCustomerId] = useState(customers.find((customer) => customer.id === order.customerId)?.localCustomerId || "");
  const [date, setDate] = useState(order.date);
  const [payment, setPayment] = useState(order.paymentMethod || "Efectivo");
  const [deposit, setDeposit] = useState(String(depositAmount ?? order.totalAmount ?? 0));
  const [lines, setLines] = useState<LineDraft[]>((order.items || []).map((item) => ({
    id: item.id, name: item.productName || item.title, sku: item.sku, quantity: String(item.quantity), price: String(item.unitPrice),
    notes: item.productionNotes || "", service: item.family === "Servicios", personalized: Boolean(item.personalization),
    assemblySummary: item.personalization?.assembly ? item.variant : undefined,
  })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const minor = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
  const itemsMinor = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (minor(line.price) || 0), 0);
  const patch = (id: string, changes: Partial<LineDraft>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!commerceSource || busy) return;
    if (!lines.length) { setError("La venta debe conservar al menos un producto."); return; }
    if (lines.some((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1 || !Number.isInteger(minor(line.price)) || minor(line.price) < 0)) { setError("Revisá cantidades y precios."); return; }
    if (!date || date > today) { setError("Revisá la fecha de venta."); return; }
    const depositMinor = minor(deposit);
    if (payment === "Seña" && (!Number.isInteger(depositMinor) || depositMinor < 0 || depositMinor > itemsMinor)) { setError("La seña debe estar entre cero y el valor de los artículos."); return; }
    setBusy(true); setError("");
    const { error: failure } = await commerceSource.rpc("gestion_update_local_sale", {
      p_sale_id: order.id, p_customer_id: customerId || null, p_sold_on: date, p_payment_method: payment,
      p_deposit_minor: payment === "Seña" ? depositMinor : null,
      p_items: lines.map((line) => ({ id: line.id, quantity: Number(line.quantity), unit_price_minor: minor(line.price), ...(line.service && line.notes.trim() ? { production_notes: line.notes.trim() } : {}) })),
    });
    setBusy(false);
    if (failure) { setError(failure.message || "No se pudieron guardar los cambios."); return; }
    await onChanged("Venta actualizada");
  }

  return <Modal title="Editar venta" className="local-sale-editor-modal" onClose={onClose}>
    <form className="local-sale-editor" onSubmit={(event) => void save(event)}>
      <div className="form-grid">
        <label>Fecha<input type="date" required max={today} value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Forma de pago<select value={payment} onChange={(event) => setPayment(event.target.value)}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
        {payment === "Seña" && <label>Seña cobrada (UYU)<input type="number" min="0" step="0.01" value={deposit} onChange={(event) => setDeposit(event.target.value)} /></label>}
        <label className="wide">Cliente<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Cliente sin registrar</option>{localCustomers.map((customer) => <option key={customer.id} value={customer.localCustomerId}>{customer.name}</option>)}</select></label>
      </div>
      <div className="local-sale-editor-lines">
        {lines.map((line) => <div className="local-sale-editor-line" key={line.id}>
          <div className="local-sale-editor-name"><strong>{line.name}</strong><small>{[line.sku, line.personalized ? "Personalizado" : ""].filter(Boolean).join(" · ")}</small>{line.assemblySummary && <small>{line.assemblySummary}</small>}</div>
          <label>Cantidad<input type="number" min="1" max="1000" step="1" value={line.quantity} onChange={(event) => patch(line.id, { quantity: event.target.value })} /></label>
          <label>Precio unitario<input type="number" min="0" step="0.01" value={line.price} onChange={(event) => patch(line.id, { price: event.target.value })} /></label>
          <button type="button" className="local-sale-remove" aria-label={`Quitar ${line.name}`} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash size={18} /></button>
          {line.service && <label className="local-sale-line-notes">Notas para producción<textarea maxLength={1000} rows={2} value={line.notes} onChange={(event) => patch(line.id, { notes: event.target.value })} /></label>}
        </div>)}
      </div>
      <p className="local-sale-editor-total">Total de artículos: <strong>{money(itemsMinor / 100)}</strong>{payment === "Seña" ? ` · Seña: ${money((minor(deposit) || 0) / 100)}` : ""}</p>
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
