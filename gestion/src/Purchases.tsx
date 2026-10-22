import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { commerceSource } from "./commerceSource";
import { money, today } from "./data";
import { Badge, Modal, Stats, Table } from "./ui";

type Currency = "UYU" | "USD";
type Category = { id: string; name: string; kind: "compra" | "gasto_fijo" | "ambas" };
type Purchase = {
  id: string; purchased_on: string; supplier: string | null; description: string; category: string; amount_minor: number; currency: Currency;
  payment_method: string | null; status: "pendiente" | "pagada"; paid_on: string | null; invoice_number: string | null; notes: string | null;
};
type FixedExpense = {
  id: string; name: string; category: string; amount_minor: number; currency: Currency; due_day: number | null; payment_method: string | null;
  starts_on: string; ends_on: string | null; active: boolean; notes: string | null;
};
type FixedPayment = { id: string; fixed_expense_id: string; month: string; amount_minor: number; paid_on: string };

const paymentMethods = ["Efectivo", "Transferencia", "Tarjeta de débito", "Tarjeta de crédito", "Mercado Pago", "Otro"];
const purchaseColumns = "id,purchased_on,supplier,description,category,amount_minor,currency,payment_method,status,paid_on,invoice_number,notes";
const fixedColumns = "id,name,category,amount_minor,currency,due_day,payment_method,starts_on,ends_on,active,notes";

const formatAmount = (minor: number, currency: Currency) => currency === "UYU"
  ? money(minor / 100)
  : new Intl.NumberFormat("es-UY", { style: "currency", currency: "USD", currencyDisplay: "code" }).format(minor / 100);
const toMinor = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const fromMinor = (minor: number) => String(minor / 100);
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("es-UY", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "—";
const monthLabel = (month: string) => new Intl.DateTimeFormat("es-UY", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const monthEnd = (month: string) => { const [year, number] = month.split("-").map(Number); return `${month}-${String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(2, "0")}`; };
const totalsByCurrency = (rows: { amount_minor: number; currency: Currency }[]) => {
  const totals = { UYU: 0, USD: 0 };
  for (const row of rows) totals[row.currency] += row.amount_minor;
  return totals;
};
const totalLabel = (totals: { UYU: number; USD: number }) => totals.USD ? `${formatAmount(totals.UYU, "UYU")} + ${formatAmount(totals.USD, "USD")}` : formatAmount(totals.UYU, "UYU");

function CategoryField({ categories, kind, value, onChange, onCreated, notify }: { categories: Category[]; kind: "compra" | "gasto_fijo"; value: string; onChange: (value: string) => void; onCreated: (category: Category) => void; notify: (message: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const options = categories.filter((category) => category.kind === "ambas" || category.kind === kind);
  const create = async () => {
    const clean = name.trim();
    if (!clean || !commerceSource) return;
    const existing = categories.find((category) => category.name.toLowerCase() === clean.toLowerCase());
    if (existing) { onChange(existing.name); setAdding(false); setName(""); return; }
    const { data, error } = await commerceSource.from("expense_categories").insert({ name: clean, kind }).select("id,name,kind").single();
    if (error || !data) { notify("No se pudo crear la categoría."); return; }
    onCreated(data as Category); onChange(clean); setAdding(false); setName("");
  };
  return <label>Categoría
    {adding
      ? <span className="purchase-new-category"><input autoFocus value={name} maxLength={60} placeholder="Nombre de la categoría" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void create(); } }} /><button type="button" className="primary" onClick={() => void create()}>Crear</button><button type="button" className="secondary" onClick={() => setAdding(false)}>Cancelar</button></span>
      : <select required value={value} onChange={(event) => event.target.value === "__new__" ? setAdding(true) : onChange(event.target.value)}>
        <option value="" disabled>Elegí una categoría</option>
        {options.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
        {value && !options.some((category) => category.name === value) && <option value={value}>{value}</option>}
        <option value="__new__">＋ Nueva categoría…</option>
      </select>}
  </label>;
}

const emptyPurchase = () => ({ purchased_on: today, supplier: "", description: "", category: "", amount: "", currency: "UYU" as Currency, payment_method: "", status: "pagada" as Purchase["status"], paid_on: today, invoice_number: "", notes: "" });

function PurchasesTab({ categories, addCategory, notify }: { categories: Category[]; addCategory: (category: Category) => void; notify: (message: string) => void }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; form: ReturnType<typeof emptyPurchase> } | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    if (!commerceSource) return;
    const { data, error } = await commerceSource.from("purchases").select(purchaseColumns).order("purchased_on", { ascending: false }).order("created_at", { ascending: false }).limit(2000);
    if (error) notify("No se pudieron cargar las compras."); else setPurchases((data || []) as Purchase[]);
    setLoading(false);
  }, [notify]);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => purchases.filter((row) => (!month || row.purchased_on.startsWith(month)) && (!category || row.category === category)), [purchases, month, category]);
  const spent = totalsByCurrency(rows.filter((row) => row.status === "pagada"));
  const pending = totalsByCurrency(rows.filter((row) => row.status === "pendiente"));
  const usedCategories = [...new Set([...categories.filter((item) => item.kind !== "gasto_fijo").map((item) => item.name), ...purchases.map((row) => row.category)])].sort((a, b) => a.localeCompare(b, "es"));
  const open = (purchase?: Purchase) => setEditing(purchase
    ? { id: purchase.id, form: { purchased_on: purchase.purchased_on, supplier: purchase.supplier || "", description: purchase.description, category: purchase.category, amount: fromMinor(purchase.amount_minor), currency: purchase.currency, payment_method: purchase.payment_method || "", status: purchase.status, paid_on: purchase.paid_on || purchase.purchased_on, invoice_number: purchase.invoice_number || "", notes: purchase.notes || "" } }
    : { id: null, form: emptyPurchase() });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !commerceSource) return;
    const { form } = editing;
    const amount = toMinor(form.amount);
    if (!Number.isFinite(amount) || amount < 0) { notify("Ingresá un importe válido."); return; }
    setSaving(true);
    const payload = { purchased_on: form.purchased_on, supplier: form.supplier.trim() || null, description: form.description.trim(), category: form.category, amount_minor: amount, currency: form.currency, payment_method: form.payment_method || null, status: form.status, paid_on: form.status === "pagada" ? form.paid_on || form.purchased_on : null, invoice_number: form.invoice_number.trim() || null, notes: form.notes.trim() || null };
    const { error } = editing.id ? await commerceSource.from("purchases").update(payload).eq("id", editing.id) : await commerceSource.from("purchases").insert(payload);
    setSaving(false);
    if (error) { notify("No se pudo guardar la compra."); return; }
    notify(editing.id ? "Compra actualizada." : "Compra agregada.");
    setEditing(null);
    await load();
  };
  const remove = async (purchase: Purchase) => {
    if (!commerceSource || !window.confirm(`¿Eliminar la compra "${purchase.description}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await commerceSource.from("purchases").delete().eq("id", purchase.id);
    if (error) { notify("No se pudo eliminar la compra."); return; }
    notify("Compra eliminada.");
    await load();
  };
  const set = <K extends keyof ReturnType<typeof emptyPurchase>>(key: K, value: ReturnType<typeof emptyPurchase>[K]) => setEditing((current) => current && { ...current, form: { ...current.form, [key]: value } });
  return <>
    <Stats items={[
      { label: month ? `Pagado en ${monthLabel(month)}` : "Pagado en total", value: totalLabel(spent), tone: "brown" },
      { label: "Pendiente de pago", value: totalLabel(pending), tone: pending.UYU || pending.USD ? "yellow" : undefined },
      { label: "Compras", value: rows.length },
    ]} />
    <div className="toolbar purchases-toolbar">
      <div className="table-actions">
        <label className="inline-label">Mes<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
        {month && <button type="button" className="secondary" onClick={() => setMonth("")}>Ver todos los meses</button>}
        <label className="inline-label">Categoría<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas</option>{usedCategories.map((name) => <option key={name}>{name}</option>)}</select></label>
      </div>
    </div>
    {loading ? <p role="status">Cargando compras…</p> : <Table rows={rows} searchText={(row) => `${row.description} ${row.supplier || ""} ${row.category} ${row.invoice_number || ""} ${row.notes || ""}`}
      action={<button type="button" className="primary" onClick={() => open()}>Agregar compra</button>}
      columns={[
        { label: "Fecha", render: (row) => dateLabel(row.purchased_on) },
        { label: "Descripción", render: (row) => <><strong>{row.description}</strong>{row.invoice_number && <small>Factura {row.invoice_number}</small>}</> },
        { label: "Proveedor", render: (row) => row.supplier || "—" },
        { label: "Categoría", render: (row) => <Badge>{row.category}</Badge> },
        { label: "Medio de pago", render: (row) => row.payment_method || "—" },
        { label: "Estado", render: (row) => <Badge tone={row.status === "pagada" ? "green" : "yellow"}>{row.status === "pagada" ? "Pagada" : "Pendiente"}</Badge> },
        { label: "Importe", render: (row) => <strong>{formatAmount(row.amount_minor, row.currency)}</strong> },
        { label: "Acciones", render: (row) => <span className="purchase-actions"><button type="button" className="secondary" onClick={() => open(row)}>Editar</button><button type="button" className="secondary" onClick={() => void remove(row)}>Eliminar</button></span> },
      ]} />}
    {!loading && !rows.length && <p className="marketing-directory-empty">Todavía no hay compras en este período. Usá “Agregar compra” para cargar la primera.</p>}
    {editing && <Modal title={editing.id ? "Editar compra" : "Agregar compra"} onClose={() => setEditing(null)}>
      <form className="purchase-form" onSubmit={save}>
        <label>Fecha de la compra<input type="date" required value={editing.form.purchased_on} onChange={(event) => set("purchased_on", event.target.value)} /></label>
        <label>Proveedor<input maxLength={120} value={editing.form.supplier} onChange={(event) => set("supplier", event.target.value)} /></label>
        <label className="purchase-wide">Descripción<input required maxLength={200} placeholder="Ej.: Cuero vacuno 10 m²" value={editing.form.description} onChange={(event) => set("description", event.target.value)} /></label>
        <CategoryField categories={categories} kind="compra" value={editing.form.category} onChange={(value) => set("category", value)} onCreated={addCategory} notify={notify} />
        <label>Importe<input required inputMode="decimal" value={editing.form.amount} onChange={(event) => set("amount", event.target.value)} /></label>
        <label>Moneda<select value={editing.form.currency} onChange={(event) => set("currency", event.target.value as Currency)}><option value="UYU">UYU (pesos)</option><option value="USD">USD (dólares)</option></select></label>
        <label>Medio de pago<select value={editing.form.payment_method} onChange={(event) => set("payment_method", event.target.value)}><option value="">Sin especificar</option>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
        <label>Estado<select value={editing.form.status} onChange={(event) => set("status", event.target.value as Purchase["status"])}><option value="pagada">Pagada</option><option value="pendiente">Pendiente de pago</option></select></label>
        {editing.form.status === "pagada" && <label>Fecha de pago<input type="date" value={editing.form.paid_on} onChange={(event) => set("paid_on", event.target.value)} /></label>}
        <label>N.º de factura<input maxLength={60} value={editing.form.invoice_number} onChange={(event) => set("invoice_number", event.target.value)} /></label>
        <label className="purchase-wide">Notas<textarea rows={3} maxLength={1000} value={editing.form.notes} onChange={(event) => set("notes", event.target.value)} /></label>
        <div className="purchase-wide purchase-form-actions"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar compra"}</button></div>
      </form>
    </Modal>}
  </>;
}

const emptyFixed = () => ({ name: "", category: "", amount: "", currency: "UYU" as Currency, due_day: "", payment_method: "", starts_on: today, ends_on: "", active: true, notes: "" });

function FixedExpensesTab({ categories, addCategory, notify }: { categories: Category[]; addCategory: (category: Category) => void; notify: (message: string) => void }) {
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [payments, setPayments] = useState<FixedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; form: ReturnType<typeof emptyFixed> } | null>(null);
  const [saving, setSaving] = useState(false);
  const loadExpenses = useCallback(async () => {
    if (!commerceSource) return;
    const { data, error } = await commerceSource.from("fixed_expenses").select(fixedColumns).order("name");
    if (error) notify("No se pudieron cargar los gastos fijos."); else setExpenses((data || []) as FixedExpense[]);
    setLoading(false);
  }, [notify]);
  const loadPayments = useCallback(async () => {
    if (!commerceSource || !month) return;
    const { data, error } = await commerceSource.from("fixed_expense_payments").select("id,fixed_expense_id,month,amount_minor,paid_on").eq("month", `${month}-01`);
    if (error) notify("No se pudieron cargar los pagos del mes."); else setPayments((data || []) as FixedPayment[]);
  }, [month, notify]);
  useEffect(() => { void loadExpenses(); }, [loadExpenses]);
  useEffect(() => { void loadPayments(); }, [loadPayments]);
  const applicable = useMemo(() => expenses.filter((item) => (showInactive || item.active) && item.starts_on <= monthEnd(month) && (!item.ends_on || item.ends_on >= `${month}-01`)), [expenses, month, showInactive]);
  const paymentFor = (id: string) => payments.find((payment) => payment.fixed_expense_id === id);
  const planned = totalsByCurrency(applicable.filter((item) => item.active));
  const paid = totalsByCurrency(applicable.filter((item) => paymentFor(item.id)).map((item) => ({ amount_minor: paymentFor(item.id)!.amount_minor, currency: item.currency })));
  const remaining = { UYU: Math.max(0, planned.UYU - paid.UYU), USD: Math.max(0, planned.USD - paid.USD) };
  const open = (expense?: FixedExpense) => setEditing(expense
    ? { id: expense.id, form: { name: expense.name, category: expense.category, amount: fromMinor(expense.amount_minor), currency: expense.currency, due_day: expense.due_day ? String(expense.due_day) : "", payment_method: expense.payment_method || "", starts_on: expense.starts_on, ends_on: expense.ends_on || "", active: expense.active, notes: expense.notes || "" } }
    : { id: null, form: emptyFixed() });
  const set = <K extends keyof ReturnType<typeof emptyFixed>>(key: K, value: ReturnType<typeof emptyFixed>[K]) => setEditing((current) => current && { ...current, form: { ...current.form, [key]: value } });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !commerceSource) return;
    const { form } = editing;
    const amount = toMinor(form.amount);
    if (!Number.isFinite(amount) || amount < 0) { notify("Ingresá un importe válido."); return; }
    if (form.ends_on && form.ends_on < form.starts_on) { notify("La fecha de fin no puede ser anterior al inicio."); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), category: form.category, amount_minor: amount, currency: form.currency, due_day: form.due_day ? Number(form.due_day) : null, payment_method: form.payment_method || null, starts_on: form.starts_on, ends_on: form.ends_on || null, active: form.active, notes: form.notes.trim() || null };
    const { error } = editing.id ? await commerceSource.from("fixed_expenses").update(payload).eq("id", editing.id) : await commerceSource.from("fixed_expenses").insert(payload);
    setSaving(false);
    if (error) { notify("No se pudo guardar el gasto fijo."); return; }
    notify(editing.id ? "Gasto fijo actualizado." : "Gasto fijo agregado.");
    setEditing(null);
    await loadExpenses();
  };
  const remove = async (expense: FixedExpense) => {
    if (!commerceSource || !window.confirm(`¿Eliminar el gasto fijo "${expense.name}" y su historial de pagos? Si solo dejó de pagarse, conviene desactivarlo.`)) return;
    const { error } = await commerceSource.from("fixed_expenses").delete().eq("id", expense.id);
    if (error) { notify("No se pudo eliminar el gasto fijo."); return; }
    notify("Gasto fijo eliminado.");
    await loadExpenses(); await loadPayments();
  };
  const togglePaid = async (expense: FixedExpense) => {
    if (!commerceSource) return;
    const existing = paymentFor(expense.id);
    const { error } = existing
      ? await commerceSource.from("fixed_expense_payments").delete().eq("id", existing.id)
      : await commerceSource.from("fixed_expense_payments").insert({ fixed_expense_id: expense.id, month: `${month}-01`, amount_minor: expense.amount_minor, paid_on: today });
    if (error) { notify("No se pudo actualizar el pago."); return; }
    await loadPayments();
  };
  return <>
    <Stats items={[
      { label: `Gastos fijos de ${monthLabel(month)}`, value: totalLabel(planned), tone: "brown" },
      { label: "Pagado", value: totalLabel(paid), tone: "green" },
      { label: "Falta pagar", value: totalLabel(remaining), tone: remaining.UYU || remaining.USD ? "yellow" : undefined },
    ]} />
    <div className="toolbar purchases-toolbar">
      <div className="table-actions">
        <label className="inline-label">Mes<input type="month" required value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} /></label>
        <label className="inline-label purchase-check"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />Mostrar inactivos</label>
      </div>
    </div>
    {loading ? <p role="status">Cargando gastos fijos…</p> : <Table rows={applicable} searchText={(row) => `${row.name} ${row.category} ${row.notes || ""}`}
      action={<button type="button" className="primary" onClick={() => open()}>Agregar gasto fijo</button>}
      columns={[
        { label: "Concepto", render: (row) => <><strong>{row.name}</strong>{!row.active && <small>Inactivo</small>}</> },
        { label: "Categoría", render: (row) => <Badge>{row.category}</Badge> },
        { label: "Vence", render: (row) => row.due_day ? `Día ${row.due_day}` : "—" },
        { label: "Medio de pago", render: (row) => row.payment_method || "—" },
        { label: "Importe", render: (row) => <strong>{formatAmount(row.amount_minor, row.currency)}</strong> },
        { label: `Estado en ${monthLabel(month)}`, render: (row) => {
          const payment = paymentFor(row.id);
          return <span className="purchase-actions"><Badge tone={payment ? "green" : "yellow"}>{payment ? `Pagado ${dateLabel(payment.paid_on)}` : "Pendiente"}</Badge><button type="button" className="secondary" onClick={() => void togglePaid(row)}>{payment ? "Deshacer" : "Marcar pagado"}</button></span>;
        } },
        { label: "Acciones", render: (row) => <span className="purchase-actions"><button type="button" className="secondary" onClick={() => open(row)}>Editar</button><button type="button" className="secondary" onClick={() => void remove(row)}>Eliminar</button></span> },
      ]} />}
    {!loading && !applicable.length && <p className="marketing-directory-empty">No hay gastos fijos para este mes. Agregá lo que pagás todos los meses, como alquiler, internet o sueldos.</p>}
    {editing && <Modal title={editing.id ? "Editar gasto fijo" : "Agregar gasto fijo"} onClose={() => setEditing(null)}>
      <form className="purchase-form" onSubmit={save}>
        <label className="purchase-wide">Concepto<input required maxLength={120} placeholder="Ej.: Alquiler del local" value={editing.form.name} onChange={(event) => set("name", event.target.value)} /></label>
        <CategoryField categories={categories} kind="gasto_fijo" value={editing.form.category} onChange={(value) => set("category", value)} onCreated={addCategory} notify={notify} />
        <label>Importe mensual<input required inputMode="decimal" value={editing.form.amount} onChange={(event) => set("amount", event.target.value)} /></label>
        <label>Moneda<select value={editing.form.currency} onChange={(event) => set("currency", event.target.value as Currency)}><option value="UYU">UYU (pesos)</option><option value="USD">USD (dólares)</option></select></label>
        <label>Día de vencimiento<input type="number" min={1} max={31} placeholder="Ej.: 10" value={editing.form.due_day} onChange={(event) => set("due_day", event.target.value)} /></label>
        <label>Medio de pago<select value={editing.form.payment_method} onChange={(event) => set("payment_method", event.target.value)}><option value="">Sin especificar</option>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
        <label>Rige desde<input type="date" required value={editing.form.starts_on} onChange={(event) => set("starts_on", event.target.value)} /></label>
        <label>Rige hasta (opcional)<input type="date" value={editing.form.ends_on} onChange={(event) => set("ends_on", event.target.value)} /></label>
        <label className="purchase-check purchase-wide"><input type="checkbox" checked={editing.form.active} onChange={(event) => set("active", event.target.checked)} />Activo (se cuenta en los gastos de cada mes)</label>
        <label className="purchase-wide">Notas<textarea rows={3} maxLength={1000} value={editing.form.notes} onChange={(event) => set("notes", event.target.value)} /></label>
        <div className="purchase-wide purchase-form-actions"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar gasto fijo"}</button></div>
      </form>
    </Modal>}
  </>;
}

export function Purchases({ notify }: { notify: (message: string) => void }) {
  const [tab, setTab] = useState<"compras" | "fijos">("compras");
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    if (!commerceSource) return;
    void commerceSource.from("expense_categories").select("id,name,kind").eq("active", true).order("name").then(({ data, error }) => {
      if (error) notify("No se pudieron cargar las categorías."); else setCategories((data || []) as Category[]);
    });
  }, [notify]);
  const addCategory = useCallback((category: Category) => setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name, "es"))), []);
  if (!commerceSource) return <p className="error" role="alert">El comercio no está conectado.</p>;
  return <div className="purchases-page">
    <div className="tabs" role="tablist" aria-label="Compras y gastos fijos">
      <button role="tab" aria-selected={tab === "compras"} className={tab === "compras" ? "active" : ""} onClick={() => setTab("compras")}>Compras</button>
      <button role="tab" aria-selected={tab === "fijos"} className={tab === "fijos" ? "active" : ""} onClick={() => setTab("fijos")}>Gastos fijos</button>
    </div>
    {tab === "compras" ? <PurchasesTab categories={categories} addCategory={addCategory} notify={notify} /> : <FixedExpensesTab categories={categories} addCategory={addCategory} notify={notify} />}
  </div>;
}
