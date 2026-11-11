import { useState, type FormEvent } from "react";
import { commerceSource } from "./commerceSource";
import { currencyMoney, money, montevideoToday, orderName, wholesaleBalanceOriginal, wholesalePaidOriginal, wholesaleTotalOriginal, type Order, type State } from "./data";
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
  const currency = order.wholesaleCurrency || "ARS";
  const total = wholesaleTotalOriginal(order);
  const collected = wholesalePaidOriginal(state, order);
  const remaining = wholesaleBalanceOriginal(state, order);
  const displayMoney = (value: number) => currencyMoney(value, currency);
  const needsOpening = currency === "ARS" && order.wholesaleOpeningPaidArg === null;
  const [opening, setOpening] = useState("");
  const [amount, setAmount] = useState(needsOpening ? "" : String(remaining || 0));
  const [rate, setRate] = useState(String(exchangeRate));
  const [method, setMethod] = useState("");
  const [date, setDate] = useState(montevideoToday);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const openingMinor = toMinor(opening);
  const sourceMinor = toMinor(amount);
  const rateValue = Number(rate.replace(",", "."));
  const equivalentMinor = currency === "ARS" ? Math.round(sourceMinor * rateValue) : sourceMinor;
  const collectedMinor = needsOpening ? (Number.isSafeInteger(openingMinor) ? openingMinor : 0) : Math.round((collected || 0) * 100);
  const availableMinor = Math.round((total || 0) * 100) - collectedMinor;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource || busy) return;
    if (!order.wholesaleSaleId) { setError("No se pudo identificar el pedido mayorista."); return; }
    if (total == null) { setError(`Primero conciliá el precio original ${currency} de este pedido.`); return; }
    if (needsOpening && (!Number.isSafeInteger(openingMinor) || openingMinor < 0 || openingMinor > Math.round(total * 100))) {
      setError("Ingresá cuánto se había cobrado antes, incluso si es cero."); return;
    }
    if (!Number.isSafeInteger(sourceMinor) || sourceMinor < 0 || (!needsOpening && sourceMinor === 0)) {
      setError("Ingresá un importe válido para el cobro."); return;
    }
    if (currency === "ARS" && (!Number.isFinite(rateValue) || rateValue <= 0)) {
      setError("Ingresá la cotización UYU por ARS de este cobro."); return;
    }
    if (sourceMinor > 0 && (!Number.isSafeInteger(equivalentMinor) || equivalentMinor <= 0 || sourceMinor > availableMinor)) {
      setError(`El cobro en ${currency} supera el saldo disponible del pedido.`); return;
    }
    if (sourceMinor > 0 && !method) { setError("Elegí el medio de pago."); return; }
    if (!date || date > montevideoToday()) { setError("Revisá la fecha del cobro."); return; }
    setBusy(true); setError("");
    const { error: failure } = currency === "UYU"
      ? await commerceSource.rpc("gestion_record_wholesale_payment_uyu", {
        p_receipt_id: receiptId, p_sale_id: order.wholesaleSaleId, p_amount_minor: sourceMinor,
        p_payment_method: method, p_paid_on: date,
      })
      : await commerceSource.rpc("gestion_record_wholesale_payment", {
        p_receipt_id: receiptId, p_sale_id: order.wholesaleSaleId,
        p_source_amount_minor: sourceMinor, p_currency: "ARS", p_uyu_per_ars: rateValue,
        p_payment_method: sourceMinor > 0 ? method : null, p_paid_on: date,
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
        <div><dt>Total del pedido</dt><dd>{total == null ? "Por conciliar" : displayMoney(total)}</dd></div>
        {needsOpening ? <div><dt>Saldo anterior</dt><dd>Por conciliar</dd></div> : <>
          <div><dt>Cobrado</dt><dd>{displayMoney(collected || 0)}</dd></div>
          <div><dt>Saldo pendiente</dt><dd>{remaining == null ? "Por conciliar" : displayMoney(remaining)}</dd></div>
        </>}
      </dl>
      {needsOpening && <label>Cobrado antes de este registro (ARS)
        <input type="number" min="0" max={total || 0} step="0.01" value={opening} onChange={(event) => setOpening(event.target.value)} required />
        <small>Confirmá el importe anterior. No se contará como un cobro de hoy.</small>
      </label>}
      <div className="form-grid">
        <label>Importe recibido ({currency})<input type="number" min={needsOpening ? "0" : "0.01"} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        {sourceMinor > 0 && <label>Medio de pago<select value={method} onChange={(event) => setMethod(event.target.value)} required><option value="">Elegir medio de pago</option>{paymentMethods.map((option) => <option key={option}>{option}</option>)}</select></label>}
        {sourceMinor > 0 && <label>Fecha del cobro<input type="date" max={montevideoToday()} value={date} onChange={(event) => setDate(event.target.value)} required /></label>}
      </div>
      {currency === "ARS" && <details><summary>Cotización para el resumen financiero</summary><label>UYU por ARS<input type="number" min="0.0001" step="any" value={rate} onChange={(event) => setRate(event.target.value)} required /></label>{sourceMinor > 0 && Number.isFinite(equivalentMinor) && <output>Equivalente: {money(equivalentMinor / 100)}</output>}</details>}
      {error && <div className="error" role="alert">{error}</div>}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="primary" disabled={busy}>{busy ? "Guardando…" : sourceMinor === 0 ? "Confirmar saldo anterior" : "Registrar cobro"}</button>
      </div>
    </form>
  </Modal>;
}
