import { useState, type FormEvent } from "react";
import { commerceSource } from "./commerceSource";
import { balance, money, montevideoToday, orderName, type Product, type State } from "./data";
import { salePriceMinor } from "./localSalePricing";
import { Modal } from "./ui";
import { accountMoney, accountOrderBalance, receiptAvailableMinor, type CustomerAccount } from "./customerAccountModel";

const toMinor = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const methods = ["Efectivo", "Débito", "Crédito", "Transferencia"];

export function CustomerAccountReceiptForm({ account, rate, onClose, onChanged }: {
  account: CustomerAccount; rate: number; onClose: () => void; onChanged: () => Promise<void> | void;
}) {
  const [receiptId] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const currency = account.currency;
  const [exchangeRate, setExchangeRate] = useState(String(rate));
  const [method, setMethod] = useState("");
  const [date, setDate] = useState(montevideoToday);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sourceMinor = toMinor(amount);
  const rateNumber = Number(exchangeRate.replace(",", "."));
  const uyuMinor = currency === "ARS" ? Math.round(sourceMinor * rateNumber) : sourceMinor;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource || busy) return;
    if (!Number.isSafeInteger(sourceMinor) || sourceMinor <= 0 || !Number.isSafeInteger(uyuMinor) || uyuMinor <= 0) {
      setError("Ingresá un importe válido."); return;
    }
    if (currency === "ARS" && (!Number.isFinite(rateNumber) || rateNumber <= 0)) {
      setError("Ingresá la cotización UYU por ARS."); return;
    }
    if (!method || !date || date > montevideoToday()) { setError("Revisá el medio de pago y la fecha."); return; }
    setBusy(true); setError("");
    const { error: failure } = await commerceSource.rpc("gestion_record_customer_account_receipt", {
      p_receipt_id: receiptId, p_contact_id: account.contactId, p_source_amount_minor: sourceMinor,
      p_currency: currency, p_uyu_per_ars: currency === "ARS" ? rateNumber : null,
      p_payment_method: method, p_paid_on: date, p_note: note.trim() || null,
    });
    if (failure) { setError(failure.message || "No se pudo registrar la entrega."); setBusy(false); return; }
    try { await onChanged(); }
    catch { setError("La entrega se registró, pero la vista no se actualizó. Recargá la página."); }
    finally { setBusy(false); }
  }

  return <Modal title={`Entrega de ${account.customer.name}`} className="customer-account-form-modal" onClose={onClose}>
    <form className="customer-account-form" onSubmit={(event) => void save(event)}>
      <div className="data-note">Esta entrega quedará a favor del cliente hasta que la asignes a uno o varios pedidos.</div>
      <div className="form-grid">
        <label>Importe recibido<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <output>Moneda: {currency}</output>
        <label>Medio de pago<select value={method} onChange={(event) => setMethod(event.target.value)} required><option value="">Elegir medio de pago</option>{methods.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Fecha de la entrega<input type="date" max={montevideoToday()} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
      </div>
      {currency === "ARS" && <details><summary>Cotización para el resumen financiero</summary><label>UYU por ARS<input type="number" min="0.0001" step="any" value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} required /></label>{Number.isFinite(uyuMinor) && uyuMinor > 0 && <output>Equivalente: {money(uyuMinor / 100)}</output>}</details>}
      <label>Nota opcional<textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Guardando…" : "Registrar entrega"}</button></div>
    </form>
  </Modal>;
}

export function CustomerAccountAllocationForm({ account, receiptId, state, onClose, onChanged }: {
  account: CustomerAccount; receiptId: string; state: State; onClose: () => void; onChanged: () => Promise<void> | void;
}) {
  const [allocationId] = useState(() => crypto.randomUUID());
  const orders = account.orders.filter((order) => (accountOrderBalance(state, order) ?? 0) > 0);
  const availableMinor = receiptAvailableMinor(account, receiptId);
  const [orderId, setOrderId] = useState(orders[0]?.id || "");
  const selected = orders.find((order) => order.id === orderId);
  const maximumMinor = Math.min(availableMinor, selected ? Math.round((accountOrderBalance(state, selected) || 0) * 100) : 0);
  const [amount, setAmount] = useState(String(maximumMinor / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource || busy) return;
    const minor = toMinor(amount);
    if (!selected || !Number.isSafeInteger(minor) || minor <= 0 || minor > maximumMinor) {
      setError("El importe debe estar dentro del saldo del pedido y del dinero a favor."); return;
    }
    setBusy(true); setError("");
    const { error: failure } = await commerceSource.rpc("gestion_allocate_customer_account_receipt", {
      p_allocation_id: allocationId, p_receipt_id: receiptId, p_order_id: selected.wholesaleSaleId || selected.id,
      p_source_amount_minor: minor,
    });
    if (failure) { setError(failure.message || "No se pudo asignar el saldo."); setBusy(false); return; }
    try { await onChanged(); }
    catch { setError("La asignación se guardó, pero la vista no se actualizó. Recargá la página."); }
    finally { setBusy(false); }
  }
  return <Modal title={`Asignar saldo de ${account.customer.name}`} className="customer-account-form-modal" onClose={onClose}>
    <form className="customer-account-form" onSubmit={(event) => void save(event)}>
      <div className="data-note">Disponible de esta entrega: {accountMoney(account, availableMinor / 100)}. La asignación reduce el saldo del pedido y no registra otro cobro.</div>
      {orders.length ? <>
        <label>Pedido<select value={orderId} onChange={(event) => { const next = orders.find((order) => order.id === event.target.value); setOrderId(event.target.value); setAmount(String(Math.min(availableMinor, next ? Math.round((accountOrderBalance(state, next) || 0) * 100) : 0) / 100)); }}>
          {orders.map((order) => <option key={order.id} value={order.id}>{orderName(order)}, falta {accountMoney(account, accountOrderBalance(state, order) || 0)}</option>)}
        </select></label>
        <label>Importe a asignar ({account.currency})<input type="number" min="0.01" max={maximumMinor / 100} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
      </> : <div className="data-note">Este cliente no tiene pedidos conciliados con saldo pendiente.</div>}
      {error && <div className="error" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cerrar</button>{orders.length > 0 && <button className="primary" disabled={busy}>{busy ? "Guardando…" : "Asignar al pedido"}</button>}</div>
    </form>
  </Modal>;
}

type FiadoLine = { id: string; product: Product; quantity: number; unitMinor: number };
export function FiadoSaleForm({ account, state, onClose, onChanged }: {
  account: CustomerAccount; state: State; onClose: () => void; onChanged: () => Promise<void> | void;
}) {
  const products = state.products.filter((product) => !product.wholesaleProductId && !product.assembly
    && product.availableChannels?.includes("Local") && product.sku && product.categoryCode !== "servicios");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<FiadoLine[]>([]);
  const [date, setDate] = useState(montevideoToday);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const found = query.trim() ? products.filter((product) => `${product.sku} ${product.name} ${product.variant}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"))).slice(0, 12) : [];
  const totalMinor = lines.reduce((sum, line) => sum + line.quantity * line.unitMinor, 0);
  function add(product: Product) {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      return existing ? current.map((line) => line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { id: crypto.randomUUID(), product, quantity: 1, unitMinor: salePriceMinor(product, "Efectivo") }];
    });
    setQuery("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource || busy) return;
    if (!account.customer.localCustomerId) { setError("Esta ficha necesita estar en la agenda minorista para registrar fiados."); return; }
    if (!lines.length || !Number.isSafeInteger(totalMinor) || totalMinor <= 0 || lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || !Number.isSafeInteger(line.unitMinor) || line.unitMinor < 0)) {
      setError("Revisá los artículos, cantidades y precios."); return;
    }
    setBusy(true); setError("");
    const { error: failure } = await commerceSource.rpc("gestion_create_local_sale_with_items", {
      p_customer_id: account.customer.localCustomerId, p_sold_on: date,
      p_payment_method: "Cuenta corriente", p_deposit_minor: 0, p_channel: "Local",
      p_items: lines.map((line) => ({ item_kind: "catalog", variant_id: line.product.id,
        quantity: line.quantity, unit_price_minor: line.unitMinor, customization: null })),
    });
    if (failure) { setError(failure.message || "No se pudo registrar la venta fiada."); setBusy(false); return; }
    try { await onChanged(); }
    catch { setError("La venta se registró, pero la vista no se actualizó. Recargá la página."); }
    finally { setBusy(false); }
  }
  return <Modal title={`Venta fiada de ${account.customer.name}`} className="customer-account-form-modal" onClose={onClose}>
    <form className="customer-account-form" onSubmit={(event) => void save(event)}>
      <div className="data-note">Los artículos se cargan al saldo del cliente. El cobro inicial es cero y se registra cada entrega por separado.</div>
      <label>Buscar mate por nombre o SKU<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {found.length > 0 && <div className="customer-account-products">{found.map((product) => <button type="button" key={product.id} onClick={() => add(product)}><strong>{product.name}</strong><small>{product.sku}, {product.variant}, {money(salePriceMinor(product, "Efectivo") / 100)}</small></button>)}</div>}
      <div className="customer-account-lines">{lines.map((line) => <div key={line.id}>
        <strong>{line.product.name}, {line.product.variant}</strong>
        <label>Cantidad<input type="number" min="1" max="1000" step="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: Number(event.target.value) } : item))} /></label>
        <label>Precio unitario<input type="number" min="0" step="0.01" value={line.unitMinor / 100} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, unitMinor: toMinor(event.target.value) } : item))} /></label>
        <button type="button" className="secondary" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>Quitar</button>
      </div>)}</div>
      <label>Fecha de venta<input type="date" max={montevideoToday()} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
      <output>Total fiado: {money(totalMinor / 100)}</output>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button className="primary" disabled={busy || !lines.length}>{busy ? "Guardando…" : "Registrar venta fiada"}</button></div>
    </form>
  </Modal>;
}
