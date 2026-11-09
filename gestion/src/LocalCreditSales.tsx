import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatContactName } from "../../shared/contactName";
import { commerceSource } from "./commerceSource";
import { balance, money, montevideoToday, orderName, paid, type Order } from "./data";
import { LocalSaleReceiptForm } from "./LocalSaleReceiptForm";
import { CustomerDetailModal, type PageProps } from "./pages";
import { Modal, Table } from "./ui";

type Line = { id: string; code: string; amount: string };
const newLine = (): Line => ({ id: crypto.randomUUID(), code: "", amount: "" });
const toMinor = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const personalizedCategories = [
  { code: "mates-personalizados", label_es: "Mates personalizados" },
  { code: "bombillas-personalizadas", label_es: "Bombillas personalizadas" },
  { code: "materas-personalizadas", label_es: "Materas personalizadas" },
];

export function LocalCreditSales(props: PageProps) {
  const [ids, setIds] = useState<string[]>([]);
  const [editor, setEditor] = useState(false);
  const [customerOrderId, setCustomerOrderId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(montevideoToday);
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const categories = [
    ...(props.commerce?.reference.categories || []).filter((item) => item.active
      && !personalizedCategories.some((category) => category.code === item.code)),
    ...personalizedCategories,
  ];
  const customers = [...props.s.customers].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const matches = customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.email}`
    .toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"))).slice(0, 30);

  const load = useCallback(async () => {
    if (!commerceSource) return;
    const found: string[] = [];
    for (let from = 0; ; from += 500) {
      const { data, error: failure } = await commerceSource.from("orders").select("id")
        .eq("channel", "Local").contains("customer_snapshot", { localCreditCategoryOnly: true })
        .order("id").range(from, from + 499);
      if (failure) throw failure;
      found.push(...(data || []).map((row) => String(row.id)));
      if (!data || data.length < 500) break;
    }
    setIds(found);
    setError("");
  }, []);
  useEffect(() => { void load().catch(() => setError("No se pudieron cargar los fiados.")); }, [load]);

  const orders = props.s.orders.filter((order) => ids.includes(order.id));
  const customerOrder = orders.find((order) => order.id === customerOrderId);
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const customerName = (order: Order) =>
    formatContactName(customersById.get(order.customerId)?.name || order.customerName || "") || "Cliente sin nombre";
  const selectedCustomer = customerOrder ? {
    ...(customersById.get(customerOrder.customerId) ?? {
      id: customerOrder.customerId, email: "", phone: "", city: "", segment: "Minorista" as const,
    }),
    name: customerName(customerOrder),
  } : null;
  const history = orders.find((order) => order.id === historyId);
  const payment = orders.find((order) => order.id === payId);
  const reset = () => { setEditor(false); setMode("existing"); setCustomerId(""); setQuery("");
    setName(""); setPhone(""); setDate(montevideoToday()); setLines([newLine()]); setError(""); };
  const updateLine = (id: string, values: Partial<Line>) => setLines((current) => current.map((line) =>
    line.id === id ? { ...line, ...values } : line));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource || busy) return;
    const categories = lines.map((line) => ({ category_code: line.code, amount_minor: toMinor(line.amount) }));
    if ((mode === "existing" && !customerId) || (mode === "new" && !name.trim()) ||
      categories.some((line) => !line.category_code || !Number.isSafeInteger(line.amount_minor) || line.amount_minor <= 0)) {
      setError("Elegí el cliente y completá las categorías con sus importes."); return;
    }
    setBusy(true); setError("");
    const selectedCustomer = mode === "existing" ? customers.find((customer) => customer.id === customerId) : undefined;
    if (mode === "existing" && !selectedCustomer) { setError("Elegí un cliente existente."); setBusy(false); return; }
    const { error: failure } = selectedCustomer && !selectedCustomer.localCustomerId
      ? await commerceSource.rpc("gestion_create_local_credit_order_for_customer", {
        p_linked_customer_id: selectedCustomer.id, p_customer_name: selectedCustomer.name,
        p_customer_email: selectedCustomer.email || null, p_customer_phone: selectedCustomer.phone || null,
        p_sold_on: date, p_categories: categories,
      })
      : await commerceSource.rpc("gestion_create_local_credit_order", {
        p_customer_id: selectedCustomer?.localCustomerId || null,
        p_new_customer_name: mode === "new" ? name.trim() : null,
        p_new_customer_phone: mode === "new" ? phone.trim() || null : null,
        p_sold_on: date, p_categories: categories,
      });
    if (failure) { setError(failure.message || "No se pudo registrar el pedido."); setBusy(false); return; }
    try { await props.refresh?.(true); await load(); reset(); props.notify("Pedido fiado registrado."); }
    catch { setError("El pedido se guardó, pero la lista no se actualizó. Actualizá la página."); }
    finally { setBusy(false); }
  }

  return <section className="local-credit-sales">
    {error && !editor && <div role="alert" className="error">{error}</div>}
    <Table title="Fiados Local" rows={orders} pageSize={30}
      searchText={(order) => `${orderName(order)} ${customerName(order)} ${order.customerName || ""} ${order.items?.map((item) => item.title).join(" ") || ""}`}
      action={<button type="button" className="primary" onClick={() => { setError(""); setEditor(true); }}>Agregar pedido</button>}
      columns={[
        { label: "Pedido", render: (order) => <strong>{orderName(order)}</strong> },
        { label: "Fecha", render: (order) => order.date },
        { label: "Cliente", render: (order) => <button type="button" className="text-button" aria-label={`Ver ficha de ${customerName(order)}`} onClick={() => setCustomerOrderId(order.id)}>{customerName(order)}</button> },
        { label: "Categorías", render: (order) => order.items?.map((item) => item.title).join(", ") || "—" },
        { label: "Importe", render: (order) => money(order.totalAmount || 0) },
        { label: "Pagado", render: (order) => money(paid(props.s, order)) },
        { label: "Saldo", render: (order) => <strong>{money(balance(props.s, order))}</strong> },
        { label: "Acciones", render: (order) => <button type="button" className="primary" aria-label={`Pagos de ${orderName(order)}`} title="Pagos" onClick={() => setHistoryId(order.id)}>$</button> },
      ]} />
    {selectedCustomer && <CustomerDetailModal customer={selectedCustomer} s={props.s} go={props.go}
      commerce={props.commerce} onClose={() => setCustomerOrderId(null)} />}
    {editor && <Modal title="Agregar pedido fiado" onClose={reset}>
      <form className="customer-account-form" onSubmit={(event) => void save(event)}>
        <div className="tabs inner-tabs" role="group" aria-label="Cliente del pedido">
          <button type="button" className={mode === "existing" ? "active" : ""} onClick={() => setMode("existing")}>Cliente existente</button>
          <button type="button" className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>Cliente nuevo</button>
        </div>
        {mode === "existing" ? <>
          <label>Buscar cliente<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label>Cliente<select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
            <option value="">Elegí un cliente</option>{matches.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select></label>
        </> : <div className="form-grid">
          <label>Nombre<input value={name} maxLength={160} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Teléfono<input value={phone} maxLength={60} onChange={(event) => setPhone(event.target.value)} /></label>
        </div>}
        <label>Fecha del pedido<input type="date" max={montevideoToday()} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <div className="customer-account-lines">{lines.map((line) => <div key={line.id} className="form-grid">
          <label>Categoría<select value={line.code} onChange={(event) => updateLine(line.id, { code: event.target.value })} required>
            <option value="">Elegí una categoría</option>{categories.map((category) => <option key={category.code} value={category.code}>{category.label_es}</option>)}
          </select></label>
          <label>Importe UYU<input type="number" min="0.01" step="0.01" value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value })} required /></label>
          {lines.length > 1 && <button type="button" className="secondary" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>Quitar</button>}
        </div>)}</div>
        <button type="button" className="secondary" onClick={() => setLines((current) => [...current, newLine()])}>Agregar categoría</button>
        <output>Total: {money(lines.reduce((sum, line) => sum + (Number.isFinite(toMinor(line.amount)) ? toMinor(line.amount) : 0), 0) / 100)}</output>
        {error && <div role="alert" className="error">{error}</div>}
        <div className="form-actions"><button type="button" className="secondary" onClick={reset}>Cancelar</button><button type="submit" className="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar pedido"}</button></div>
      </form>
    </Modal>}
    {history && <Modal title={`Pagos de ${orderName(history)}`} onClose={() => setHistoryId(null)}>
      <div className="customer-account-form">
        <strong>Saldo pendiente: {money(balance(props.s, history))}</strong>
        <Table title="Pagos registrados" rows={props.s.payments.filter((entry) => entry.orderId === history.id && (entry.amount || 0) > 0)}
          searchText={(entry) => `${entry.date} ${entry.method}`}
          columns={[
            { label: "Fecha", render: (entry) => entry.date },
            { label: "Medio", render: (entry) => entry.method },
            { label: "Importe", render: (entry) => money(entry.amount || 0) },
          ]} />
        <div className="form-actions"><button type="button" className="secondary" onClick={() => setHistoryId(null)}>Cerrar</button>
          <button type="button" className="primary" disabled={balance(props.s, history) <= 0} onClick={() => { setHistoryId(null); setPayId(history.id); }}>Registrar pago</button></div>
      </div>
    </Modal>}
    {payment && <LocalSaleReceiptForm order={payment} remaining={balance(props.s, payment)}
      onClose={() => setPayId(null)} onChanged={async () => { await props.refresh?.(true); setPayId(null); setHistoryId(payment.id); props.notify("Pago registrado."); }} />}
  </section>;
}
