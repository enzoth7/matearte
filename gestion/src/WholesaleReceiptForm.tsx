import { useState, type FormEvent } from "react";
import { commerceSource } from "./commerceSource";
import { arsMoney, money, montevideoToday, orderName, wholesaleBalanceArs, wholesalePaidArs, type Order, type State } from "./data";
import { Modal } from "./ui";

const paymentMethods = ["Efectivo", "Débito", "Crédito", "Transferencia"];
const toMinor = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);

export function WholesaleReceiptForm({ order, state, exchangeRate, onClose, onChanged }: {
  order: Order;
  state: State;
  exchangeRate: number;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [receiptId] = useState(() => crypto.randomUUID());
  const needsOpening = order.wholesaleOpeningPaidArg === null;
  const [opening, setOpening] = useState("");
  const [amount, setAmount] = useState(needsOpening ? "" : String(wholesaleBalanceArs(state, order) || 0));
  const [rate, setRate] = useState(String(exchangeRate));
  const [method, setMethod] = useState("");
  const [date, setDate] = useState(montevideoToday);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const openingMinor = toMinor(opening);
  const sourceMinor = toMinor(amount);
  const rateValue = Number(rate.replace(",", "."));
  const equivalentMinor = Math.round(sourceMinor * rateValue);
  const collectedMinor = needsOpening ? (Number.isSafeInteger(openingMinor) ? openingMinor : 0) : Math.round((wholesalePaidArs(state, order) || 0) * 100);
  const availableMinor = Math.round((order.wholesaleTotalArg || 0) * 100) - collectedMinor;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource || busy) return;
    if (!order.wholesaleSaleId) { setError("No se pudo identificar el pedido mayorista."); return; }
    if (order.wholesaleTotalArg == null) { setError("Primero conciliá el precio original ARS de este pedido."); return; }
    if (needsOpening && (!Number.isSafeInteger(openingMinor) || openingMinor < 0 || openingMinor > Math.round(order.wholesaleTotalArg * 100))) {
      setError("Ingresá cuánto se había cobrado antes, incluso si es cero."); return;
    }
    if (!Number.isSafeInteger(sourceMinor) || sourceMinor < 0 || (!needsOpening && sourceMinor === 0)) {
      setError("Ingresá un importe válido para el cobro."); return;
    }
    if (!Number.isFinite(rateValue) || rateValue <= 0) {
      setError("Ingresá la cotización UYU por ARS de este cobro."); return;
    }
    if (sourceMinor > 0 && (!Number.isSafeInteger(equivalentMinor) || equivalentMinor <= 0 || equivalentMinor > availableMinor)) {
      setError("El cobro en ARS supera el saldo disponible del pedido."); return;
    }
    if (sourceMinor > 0 && !method) { setError("Elegí el medio de pago."); return; }
    if (!date || date > montevideoToday()) { setError("Revisá la fecha del cobro."); return; }
    setBusy(true); setError("");
    const { error: failure } = await commerceSource.rpc("gestion_record_wholesale_payment", {
      p_receipt_id: receiptId,
      p_sale_id: order.wholesaleSaleId,
      p_source_amount_minor: sourceMinor,
      p_currency: "ARS",
      p_uyu_per_ars: rateValue,
      p_payment_method: sourceMinor > 0 ? method : null,
      p_paid_on: date,
      p_opening_collected_arg_minor: needsOpening ? openingMinor : null,
    });
    if (failure) { setError(failure.message || "No se pudo registrar el cobro."); setBusy(false); return; }
    try { await onChanged(); }
    catch { setError("El cobro se registró, pero no se pudo actualizar la vista. Recargá la página."); }
    finally { setBusy(false); }
  }

  return <Modal title={`Registrar cobro de ${orderName(order)}`} className="wholesale-receipt-modal" onClose={onClose}>
    <form className="wholesale-receipt-form" onSubmit={(event) => void save(event)}>
      <dl className="receipt-summary">
        <div><dt>Total del pedido</dt><dd>{order.wholesaleTotalArg == null ? "Por conciliar" : arsMoney(order.wholesaleTotalArg)}</dd></div>
        {needsOpening ? <div><dt>Saldo anterior</dt><dd>Por conciliar</dd></div> : <>
          <div><dt>Cobrado</dt><dd>{arsMoney(wholesalePaidArs(state, order) || 0)}</dd></div>
          <div><dt>Saldo pendiente</dt><dd>{wholesaleBalanceArs(state, order) == null ? "Por conciliar" : arsMoney(wholesaleBalanceArs(state, order) || 0)}</dd></div>
        </>}
      </dl>
      {needsOpening && <label>Cobrado antes de este registro (ARS)
        <input type="number" min="0" max={order.wholesaleTotalArg || 0} step="0.01" value={opening} onChange={(event) => setOpening(event.target.value)} required />
        <small>Confirmá el importe anterior. No se contará como un cobro de hoy.</small>
      </label>}
      <div className="form-grid">
        <label>Importe recibido (ARS)<input type="number" min={needsOpening ? "0" : "0.01"} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        {sourceMinor > 0 && <label>Medio de pago<select value={method} onChange={(event) => setMethod(event.target.value)} required><option value="">Elegir medio de pago</option>{paymentMethods.map((option) => <option key={option}>{option}</option>)}</select></label>}
        {sourceMinor > 0 && <label>Fecha del cobro<input type="date" max={montevideoToday()} value={date} onChange={(event) => setDate(event.target.value)} required /></label>}
      </div>
      <details><summary>Cotización para el resumen financiero</summary><label>UYU por ARS<input type="number" min="0.0001" step="any" value={rate} onChange={(event) => setRate(event.target.value)} required /></label>{sourceMinor > 0 && Number.isFinite(equivalentMinor) && <output>Equivalente: {money(equivalentMinor / 100)}</output>}</details>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="primary" disabled={busy}>{busy ? "Guardando…" : sourceMinor === 0 ? "Confirmar saldo anterior" : "Registrar cobro"}</button>
      </div>
    </form>
  </Modal>;
}
