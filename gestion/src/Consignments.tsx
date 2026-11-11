import { useState, type FormEvent } from "react";
import { Plus } from "@phosphor-icons/react";
import { currencyMoney, montevideoToday, orderName, type Order, type WholesaleConsignment, type WholesaleConsignmentMovement } from "./data";
import { consignmentLineBalances, consignmentReceiptAvailableMinor, consignmentSummary, type ConsignmentLineBalance } from "./consignmentModel";
import { allocateConsignmentReceipt, createConsignment, recordConsignmentMovement, recordConsignmentPayment } from "./consignmentSource";
import { formatDate } from "./dateFormat";
import type { PageProps } from "./pages";
import { Badge, Modal, Stats, Table } from "./ui";

const methods = ["Efectivo", "Débito", "Crédito", "Transferencia"];
const toMinor = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const errorText = (value: unknown) => value instanceof Error ? value.message : "No se pudo guardar el movimiento.";

function NewConsignment({ props, onClose, onCreated }: {
  props: PageProps; onClose: () => void; onCreated: (id: string) => Promise<void>;
}) {
  const wholesale = props.commerce?.wholesale;
  const [id] = useState(() => crypto.randomUUID());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const records = new Map((wholesale?.orderRecords || []).map((record) => [record.id, record]));
  const openings = new Map((wholesale?.paymentOpenings || []).map((opening) => [opening.sale_id, opening]));
  const orderCurrency = (order: Order): "ARS" | "UYU" => records.get(order.wholesaleSaleId || "")?.wholesale_currency || order.wholesaleCurrency || "ARS";
  const eligible = (order: Order) => {
    const saleId = order.wholesaleSaleId || "";
    const record = records.get(saleId);
    const opening = openings.get(saleId);
    const currency = orderCurrency(order);
    return order.source === "wholesale" && !!record?.contact_id && !order.consignmentId
      && !record.paid_at && !record.shipped_at && !record.delivered_at
      && !["cancelled", "refunded", "payment_failed"].includes(record.status || "")
      && !opening?.paid_in_full_without_price && !opening?.finance_paid_at_order
      && !(opening?.collected_arg_minor || opening?.collected_minor)
      && !(wholesale?.receipts || []).some((receipt) => receipt.sale_id === saleId)
      && !(props.s.accountAllocations || []).some((allocation) => allocation.orderId === saleId)
      && (currency === "ARS" ? order.wholesaleTotalArg != null : order.wholesaleTotalUyu != null)
      && !!order.items?.length
      && order.items.every((line) => !!line.sku && !!line.wholesaleLineId
        && (currency === "UYU" || line.priceArg != null));
  };
  const matches = props.s.orders.filter((order) => eligible(order)
    && `${orderName(order)} ${order.customerName || ""}`.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!selected?.wholesaleSaleId || !eligible(selected)) { setError("Elegí un pedido mayorista disponible."); return; }
    setBusy(true); setError("");
    try {
      await createConsignment(id, selected.wholesaleSaleId, orderCurrency(selected));
      await onCreated(id);
    } catch (failure) { setError(errorText(failure)); setBusy(false); }
  }
  return <Modal title="Nueva consignación" className="consignment-modal" onClose={onClose}>
    <form className="consignment-form" onSubmit={(event) => void save(event)}>
      <label>Buscar pedido mayorista<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Número o cliente" /></label>
      <div className="consignment-order-results" role="group" aria-label="Pedidos mayoristas disponibles">{matches.map((order) =>
        <button type="button" key={order.id} aria-pressed={selected?.id === order.id} onClick={() => setSelected(order)}>
          <strong className="consignment-order-number">{orderName(order)}</strong>
          <strong className="consignment-order-customer">{order.customerName}</strong>
          <strong className="consignment-order-amount">{currencyMoney((orderCurrency(order) === "ARS" ? order.wholesaleTotalArg : order.wholesaleTotalUyu) || 0, orderCurrency(order))}</strong>
          <small className="consignment-order-units">{order.items?.reduce((sum, line) => sum + line.quantity, 0)} unidades</small>
        </button>)}</div>
      {selected && <section className="consignment-order-summary"><h3>{orderName(selected)}, {selected.customerName}</h3>
        <div><strong>Moneda pactada</strong><strong>{orderCurrency(selected)}</strong></div>
        {(selected.items || []).map((line) => <div key={line.id}><strong>{line.title}</strong><small>{line.quantity} unidades, {currencyMoney(orderCurrency(selected) === "ARS" ? line.priceArg || 0 : line.amount, orderCurrency(selected))} en el pedido</small></div>)}
        <div className="data-note">La moneda y los precios del pedido quedarán guardados en la consignación.</div>
      </section>}
      {error && <div className="error" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button className="primary" disabled={busy || !selected}>{busy ? "Guardando…" : "Crear consignación"}</button></div>
    </form>
  </Modal>;
}

function MovementForm({ line, kind, onClose, onSaved }: {
  line: ConsignmentLineBalance; kind: WholesaleConsignmentMovement["kind"];
  onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const max = kind === "dispatch" ? line.availableToDispatch : line.held;
  const [quantity, setQuantity] = useState(String(max));
  const [date, setDate] = useState(montevideoToday);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = kind === "dispatch" ? "Registrar envío" : kind === "return" ? "Registrar devolución" : "Confirmar que se queda";
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count = Number(quantity);
    if (!Number.isInteger(count) || count < 1 || count > max || !date || date > montevideoToday()) {
      setError("Revisá las unidades y la fecha del movimiento."); return;
    }
    setBusy(true); setError("");
    try {
      await recordConsignmentMovement({ id, lineId: line.id, kind, quantity: count, occurredOn: date, carrier, tracking, note });
      await onSaved();
    } catch (failure) { setError(errorText(failure)); setBusy(false); }
  }
  return <Modal title={label} className="consignment-action-modal" onClose={onClose}>
    <form className="consignment-form" onSubmit={(event) => void save(event)}>
      <strong>{line.title}, SKU {line.sku}</strong>
      <div className="data-note">{kind === "dispatch" ? "Terminadas sin enviar" : "En poder del cliente"}: {max} unidades.</div>
      <label>Unidades<input type="number" min="1" max={max} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
      <label>Fecha<input type="date" max={montevideoToday()} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
      {kind === "dispatch" && <><label>Transportista opcional<input value={carrier} onChange={(event) => setCarrier(event.target.value)} /></label>
        <label>Seguimiento opcional<input value={tracking} onChange={(event) => setTracking(event.target.value)} /></label></>}
      <label>Nota opcional<textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Guardando…" : label}</button></div>
    </form>
  </Modal>;
}

function PaymentForm({ props, consignment, onClose, onSaved }: {
  props: PageProps; consignment: WholesaleConsignment; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [receiptId] = useState(() => crypto.randomUUID());
  const [allocationId] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState(String(props.commerce?.wholesale?.exchangeRate || consignment.exchangeRate));
  const [method, setMethod] = useState("");
  const [date, setDate] = useState(montevideoToday);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountMinor = toMinor(amount);
    const exchangeRate = Number(rate.replace(",", "."));
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || (consignment.currency === "ARS" && (!Number.isFinite(exchangeRate)
      || exchangeRate <= 0)) || !method || !date || date > montevideoToday()) {
      setError("Revisá importe, cotización, medio y fecha del cobro."); return;
    }
    setBusy(true); setError("");
    try {
      await recordConsignmentPayment({ receiptId, allocationId, consignmentId: consignment.id,
        amountMinor, exchangeRate: consignment.currency === "ARS" ? exchangeRate : null, method, paidOn: date, note });
      await onSaved();
    } catch (failure) { setError(errorText(failure)); setBusy(false); }
  }
  return <Modal title="Registrar entrega de dinero" className="consignment-action-modal" onClose={onClose}>
    <form className="consignment-form" onSubmit={(event) => void save(event)}>
      <label>Importe recibido {consignment.currency}<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
      <label>Medio de pago<select value={method} onChange={(event) => setMethod(event.target.value)} required><option value="">Elegir medio</option>{methods.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
      <label>Fecha<input type="date" max={montevideoToday()} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
      {consignment.currency === "ARS" && <details><summary>Cotización para el resumen financiero</summary><label>UYU por ARS<input type="number" min="0.0001" step="any" value={rate} onChange={(event) => setRate(event.target.value)} required /></label></details>}
      <label>Nota opcional<textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="data-note">El importe se aplica al saldo confirmado. Si sobra, queda a favor del cliente en {consignment.currency}.</div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Guardando…" : "Registrar entrega"}</button></div>
    </form>
  </Modal>;
}

function CreditForm({ props, consignment, onClose, onSaved }: {
  props: PageProps; consignment: WholesaleConsignment; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const balanceMinor = consignmentSummary(props.s, consignment).balanceMinor;
  const receipts = (props.s.accountReceipts || []).filter((receipt) => receipt.contactId === consignment.contactId
    && receipt.currency === consignment.currency && consignmentReceiptAvailableMinor(props.s, receipt.id, consignment.currency) > 0);
  const [receiptId, setReceiptId] = useState(receipts[0]?.id || "");
  const availableMinor = Math.min(balanceMinor, consignmentReceiptAvailableMinor(props.s, receiptId));
  const [amount, setAmount] = useState(String(availableMinor / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountMinor = toMinor(amount);
    if (!receiptId || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > availableMinor) {
      setError("La asignación supera el saldo o el dinero disponible."); return;
    }
    setBusy(true); setError("");
    try { await allocateConsignmentReceipt({ id, receiptId, consignmentId: consignment.id, amountMinor }); await onSaved(); }
    catch (failure) { setError(errorText(failure)); setBusy(false); }
  }
  return <Modal title="Aplicar dinero a favor" className="consignment-action-modal" onClose={onClose}>
    <form className="consignment-form" onSubmit={(event) => void save(event)}>
      {receipts.length ? <><label>Entrega {consignment.currency}<select value={receiptId} onChange={(event) => { setReceiptId(event.target.value); setAmount(String(Math.min(balanceMinor, consignmentReceiptAvailableMinor(props.s, event.target.value)) / 100)); }}>
        {receipts.map((receipt) => <option value={receipt.id} key={receipt.id}>{formatDate(receipt.paidOn)}, disponible {currencyMoney(consignmentReceiptAvailableMinor(props.s, receipt.id) / 100, consignment.currency)}</option>)}
      </select></label><label>Importe a aplicar {consignment.currency}<input type="number" min="0.01" max={availableMinor / 100} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label></>
        : <div className="data-note">Este cliente no tiene entregas {consignment.currency} sin asignar.</div>}
      {error && <div className="error" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cerrar</button>{receipts.length > 0 && <button className="primary" disabled={busy}>{busy ? "Guardando…" : "Aplicar saldo"}</button>}</div>
    </form>
  </Modal>;
}

function ConsignmentDetail({ props, consignment, onClose }: {
  props: PageProps; consignment: WholesaleConsignment; onClose: () => void;
}) {
  const [tab, setTab] = useState<"products" | "movements" | "receipts">("products");
  const [action, setAction] = useState<{ line: ConsignmentLineBalance; kind: WholesaleConsignmentMovement["kind"] } | null>(null);
  const [linePickerKind, setLinePickerKind] = useState<"return" | "kept" | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const summary = consignmentSummary(props.s, consignment);
  const availableLines = summary.lines.filter((line) => line.held > 0);
  const openLineAction = (kind: "return" | "kept") => {
    if (availableLines.length === 1) setAction({ line: availableLines[0], kind });
    else if (availableLines.length > 1) setLinePickerKind(kind);
  };
  const order = props.s.orders.find((entry) => entry.wholesaleSaleId === consignment.orderId);
  const customer = props.s.customers.find((entry) => entry.contactId === consignment.contactId)?.name
    || props.commerce?.wholesale?.contacts?.find((entry) => entry.id === consignment.contactId)?.wholesale_name || "Cliente mayorista";
  const receipts = new Map((props.s.accountReceipts || []).map((receipt) => [receipt.id, receipt]));
  const customerReceipts = (props.s.accountReceipts || []).filter((receipt) =>
    receipt.contactId === consignment.contactId && receipt.currency === consignment.currency)
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.id.localeCompare(a.id));
  const linesById = new Map(summary.lines.map((line) => [line.id, line]));
  const events = [
    ...(props.s.consignmentMovements || []).filter((movement) => summary.lines.some((line) => line.id === movement.lineId))
      .map((movement) => {
        const line = linesById.get(movement.lineId);
        const valueMinor = movement.quantity * (line?.unitPriceMinor || 0);
        return { id: movement.id, date: movement.occurredOn,
          label: movement.kind === "dispatch" ? "Envío" : movement.kind === "return" ? "Devolución" : "Se queda",
          detail: line?.title || "Producto", quantity: movement.quantity,
          amount: movement.kind === "return" ? -valueMinor : valueMinor,
          amountLabel: movement.kind === "dispatch" ? "Valor enviado" : movement.kind === "return" ? "Valor devuelto" : "Cargo confirmado",
          note: [movement.carrier, movement.tracking, movement.note].filter(Boolean).join(", ") };
      }),
    ...(props.s.consignmentAllocations || []).filter((allocation) => allocation.consignmentId === consignment.id)
      .map((allocation) => ({ id: allocation.id, date: receipts.get(allocation.receiptId)?.paidOn || allocation.allocatedAt.slice(0, 10),
        label: "Pago aplicado", detail: receipts.get(allocation.receiptId)?.paymentMethod || `Entrega ${consignment.currency}`,
        quantity: 0, amount: -allocation.sourceAmountMinor, amountLabel: "", note: "" })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const availableCreditMinor = (props.s.accountReceipts || []).filter((receipt) => receipt.contactId === consignment.contactId && receipt.currency === consignment.currency)
    .reduce((sum, receipt) => sum + consignmentReceiptAvailableMinor(props.s, receipt.id), 0);
  const changed = async () => { await props.refresh?.(true); setAction(null); setPaymentOpen(false); setCreditOpen(false); };
  return <>
    <Modal title={`Consignación ${order ? orderName(order) : ""}`} className="consignment-detail-modal" onClose={onClose}>
      <div className="consignment-detail-head"><h2>{customer}</h2><Badge tone={summary.status === "Cerrada" || summary.status === "Enviado" ? "green" : summary.status === "Por cobrar" ? "red" : "yellow"}>{summary.status}</Badge></div>
      <Stats items={[
        { label: "Enviadas", value: summary.dispatched },
        { label: "Devueltas", value: summary.returned }, { label: "Conservadas", value: summary.kept },
        { label: "Importe confirmado", value: currencyMoney(summary.confirmedMinor / 100, consignment.currency) },
        { label: "Pagos aplicados", value: currencyMoney(summary.paidMinor / 100, consignment.currency), tone: "green" },
        { label: "Saldo", value: currencyMoney(summary.balanceMinor / 100, consignment.currency), tone: summary.balanceMinor > 0 ? "yellow" : undefined },
      ]} />
      {availableCreditMinor > 0 && <div className="data-note">Dinero {consignment.currency} a favor del cliente sin asignar: {currencyMoney(availableCreditMinor / 100, consignment.currency)}.</div>}
      <nav className="tabs inner-tabs consignment-detail-tabs" role="tablist" aria-label="Detalle de la consignación">
        <button type="button" role="tab" id="consignment-tab-products" className={tab === "products" ? "active" : ""} aria-controls="consignment-panel-products" aria-selected={tab === "products"} onClick={() => setTab("products")}>Productos y unidades</button>
        <button type="button" role="tab" id="consignment-tab-movements" className={tab === "movements" ? "active" : ""} aria-controls="consignment-panel-movements" aria-selected={tab === "movements"} onClick={() => setTab("movements")}>Movimientos</button>
        <button type="button" role="tab" id="consignment-tab-receipts" className={tab === "receipts" ? "active" : ""} aria-controls="consignment-panel-receipts" aria-selected={tab === "receipts"} onClick={() => setTab("receipts")}>Entregas</button>
      </nav>
      {tab === "products" && <section id="consignment-panel-products" role="tabpanel" aria-labelledby="consignment-tab-products"><Table title="Productos y unidades" className="consignment-products-table" rows={summary.lines} pageSize={30} searchText={(line) => `${line.title} ${line.sku}`} columns={[
        { label: "Producto", render: (line) => <div><strong>{line.title}</strong><small>SKU {line.sku}</small></div> },
        { label: "Pactado por unidad", render: (line) => currencyMoney(line.unitPriceMinor / 100, consignment.currency) },
        { label: "Pedido", render: (line) => line.quantity },
        { label: "Enviadas", render: (line) => line.dispatched },
        { label: "Devueltas", render: (line) => line.returned },
        { label: "Conservadas", render: (line) => line.kept },
      ]} /></section>}
      {tab === "movements" && <section id="consignment-panel-movements" role="tabpanel" aria-labelledby="consignment-tab-movements"><Table title="Movimientos" rows={events} pageSize={30} searchText={(event) => `${event.label} ${event.detail} ${event.note}`} columns={[
        { label: "Fecha", render: (event) => formatDate(event.date) },
        { label: "Movimiento", render: (event) => event.label },
        { label: "Detalle", render: (event) => <div>{event.detail}{event.note && <small>{event.note}</small>}</div> },
        { label: "Unidades", render: (event) => event.quantity || "—" },
        { label: consignment.currency, render: (event) => <div className="consignment-event-amount">
          <strong>{event.amount < 0 ? "−" : ""}{currencyMoney(Math.abs(event.amount) / 100, consignment.currency)}</strong>
          {event.amountLabel && <small>{event.amountLabel}</small>}
        </div> },
      ]} /></section>}
      {tab === "receipts" && <section id="consignment-panel-receipts" role="tabpanel" aria-labelledby="consignment-tab-receipts"><Table title={`Entregas ${consignment.currency} del cliente`} rows={customerReceipts} pageSize={20} searchText={(receipt) => `${receipt.paidOn} ${receipt.paymentMethod} ${receipt.note || ""}`} columns={[
        { label: "Fecha", render: (receipt) => formatDate(receipt.paidOn) },
        { label: "Medio", render: (receipt) => receipt.paymentMethod },
        { label: "Recibido", render: (receipt) => currencyMoney(receipt.sourceAmountMinor / 100, consignment.currency) },
        { label: "Aplicado aquí", render: (receipt) => currencyMoney((props.s.consignmentAllocations || [])
          .filter((allocation) => allocation.receiptId === receipt.id && allocation.consignmentId === consignment.id)
          .reduce((sum, allocation) => sum + allocation.sourceAmountMinor, 0) / 100, consignment.currency) },
        { label: "A favor", render: (receipt) => currencyMoney(consignmentReceiptAvailableMinor(props.s, receipt.id) / 100, consignment.currency) },
        { label: "Nota", render: (receipt) => receipt.note || "—" },
      ]} /></section>}
      <footer className="consignment-detail-actions">
        <button className="secondary" type="button" disabled={!availableLines.length} onClick={() => openLineAction("kept")}>Registrar conservadas</button>
        <button className="secondary" type="button" disabled={!availableLines.length} onClick={() => openLineAction("return")}>Registrar devolución</button>
        <button className="primary" type="button" onClick={() => setPaymentOpen(true)}>Registrar entrega de dinero</button>
        {summary.balanceMinor > 0 && availableCreditMinor > 0 && <button className="secondary" type="button" onClick={() => setCreditOpen(true)}>Aplicar dinero a favor</button>}
        <button className="secondary" type="button" onClick={() => props.go("/produccion/mayorista")}>Ver producción</button>
      </footer>
    </Modal>
    {linePickerKind && <Modal title={`Elegir producto para ${linePickerKind === "return" ? "la devolución" : "registrar conservadas"}`} className="consignment-action-modal" onClose={() => setLinePickerKind(null)}>
      <div className="consignment-line-picker">{availableLines.map((line) => <button type="button" className="secondary" key={line.id} onClick={() => { setAction({ line, kind: linePickerKind }); setLinePickerKind(null); }}>{line.title}, SKU {line.sku}, {line.held} unidades disponibles</button>)}</div>
    </Modal>}
    {action && <MovementForm key={action.line.id + action.kind} line={action.line} kind={action.kind} onClose={() => setAction(null)} onSaved={changed} />}
    {paymentOpen && <PaymentForm props={props} consignment={consignment} onClose={() => setPaymentOpen(false)} onSaved={changed} />}
    {creditOpen && <CreditForm props={props} consignment={consignment} onClose={() => setCreditOpen(false)} onSaved={changed} />}
  </>;
}

export function Consignments(props: PageProps) {
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("consignacion"));
  const consignments = [...(props.s.consignments || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selected = consignments.find((entry) => entry.id === selectedId);
  const rows = consignments.map((consignment) => {
    const summary = consignmentSummary(props.s, consignment);
    const order = props.s.orders.find((entry) => entry.wholesaleSaleId === consignment.orderId);
    const customer = props.s.customers.find((entry) => entry.contactId === consignment.contactId)?.name
      || props.commerce?.wholesale?.contacts?.find((entry) => entry.id === consignment.contactId)?.wholesale_name || "Cliente mayorista";
    return { ...consignment, ...summary, customer, reference: order ? orderName(order) : "Pedido mayorista" };
  });
  const balanceFor = (currency: "UYU" | "ARS") => rows.filter((row) => row.currency === currency)
    .reduce((sum, row) => sum + row.balanceMinor, 0);
  return <section className="consignments-page">
    <Stats items={[
      { label: "Consignaciones activas", value: rows.filter((row) => row.status !== "Cerrada").length },
      { label: "Unidades enviadas", value: rows.reduce((sum, row) => sum + row.dispatched, 0) },
      { label: "Unidades devueltas", value: rows.reduce((sum, row) => sum + row.returned, 0) },
      { label: "Saldo UYU", value: currencyMoney(balanceFor("UYU") / 100, "UYU"), tone: "yellow" },
      { label: "Saldo ARS", value: currencyMoney(balanceFor("ARS") / 100, "ARS"), tone: "yellow" },
    ]} />
    <Table title="Consignaciones" className="consignments-list" rows={rows} pageSize={30} searchText={(row) => `${row.customer} ${row.reference} ${row.status}`} action={<button type="button" className="primary" onClick={() => setCreating(true)}>Nueva consignación</button>} columns={[
      { label: "Pedido", render: (row) => row.reference }, { label: "Cliente", render: (row) => <strong>{row.customer}</strong> },
      { label: "Fecha", render: (row) => formatDate(row.createdAt) },
      { label: "Enviadas", render: (row) => row.dispatched },
      { label: "Devueltas", render: (row) => row.returned }, { label: "Conservadas", render: (row) => row.kept },
      { label: "Moneda", render: (row) => row.currency },
      { label: "Confirmado", render: (row) => currencyMoney(row.confirmedMinor / 100, row.currency) },
      { label: "Pagos aplicados", render: (row) => currencyMoney(row.paidMinor / 100, row.currency) },
      { label: "Saldo", render: (row) => currencyMoney(row.balanceMinor / 100, row.currency) },
      { label: "Estado", render: (row) => <Badge tone={row.status === "Cerrada" || row.status === "Enviado" ? "green" : row.status === "Por cobrar" ? "red" : "yellow"}>{row.status}</Badge> },
      { label: "Acciones", render: (row) => <button type="button" className="secondary order-details-button" aria-label={`Ver detalle de ${row.reference}`} title="Ver detalle" onClick={() => setSelectedId(row.id)}><Plus size={18} weight="bold" aria-hidden="true" /></button> },
    ]} />
    {creating && <NewConsignment props={props} onClose={() => setCreating(false)} onCreated={async (id) => { await props.refresh?.(true); setCreating(false); setSelectedId(id); }} />}
    {selected && <ConsignmentDetail props={props} consignment={selected} onClose={() => setSelectedId(null)} />}
  </section>;
}
