import { useState, type FormEvent } from "react";
import { commerceSource } from "./commerceSource";
import { money, orderName, today, type Order } from "./data";
import { Modal } from "./ui";

const paymentMethods = ["Efectivo", "Débito", "Crédito", "Transferencia"];
const toMinor = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);

export function LocalSaleReceiptForm({ order, remaining, onClose, onChanged }: {
  order: Order;
  remaining: number;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [receiptId] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState("");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remainingMinor = Math.round(remaining * 100);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource || busy) return;
    const amountMinor = toMinor(amount);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > remainingMinor) {
      setError("El cobro debe ser mayor que cero y no superar el saldo pendiente."); return;
    }
    if (!method) { setError("Elegí el medio de pago."); return; }
    if (!date || date < order.date || date > today) { setError("Revisá la fecha del cobro."); return; }
    setBusy(true); setError("");
    const { error: failure } = await commerceSource.rpc("gestion_record_local_sale_payment", {
      p_receipt_id: receiptId,
      p_sale_id: order.id,
      p_amount_minor: amountMinor,
      p_payment_method: method,
      p_paid_on: date,
    });
    if (failure) { setError(failure.message || "No se pudo registrar el cobro."); setBusy(false); return; }
    try { await onChanged(); }
    catch { setError("El cobro se registró, pero no se pudo actualizar la vista. Recargá la página."); }
    finally { setBusy(false); }
  }

  return <Modal title={`Registrar cobro de ${orderName(order)}`} className="local-sale-receipt-modal" onClose={onClose}>
    <form className="local-sale-receipt-form" onSubmit={(event) => void save(event)}>
      <p>Saldo pendiente: <strong>{money(remaining)}</strong></p>
      <div className="form-grid">
        <label>Importe cobrado (UYU)<input type="number" min="0.01" max={remaining} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <label>Medio de pago<select value={method} onChange={(event) => setMethod(event.target.value)} required><option value="">Elegir medio de pago</option>{paymentMethods.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Fecha del cobro<input type="date" min={order.date} max={today} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="primary" disabled={busy}>{busy ? "Guardando…" : "Registrar cobro"}</button>
      </div>
    </form>
  </Modal>;
}
