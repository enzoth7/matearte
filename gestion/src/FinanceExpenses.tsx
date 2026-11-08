import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { commerceSource } from "./commerceSource";
import { money } from "./data";
import { formatDate } from "./dateFormat";
import { montevideoToday } from "./overview";
import { readFinanceOpenings, saveFinanceOpening, type FinanceOpening } from "./financeOpeningSource";
import { financeAmountLabel, readCurrentFinanceRate, type FinanceCurrency } from "./financeCurrency";
import { Badge, Modal, Stats, Table } from "./ui";
import "./financeExpenses.css";

type Currency = FinanceCurrency;
type Category = { id: string; name: string; kind: "compra" | "gasto_fijo" | "ambas"; active?: boolean };
type Purchase = {
  id: string; purchased_on: string; due_on: string | null; paid_on: string | null;
  supplier: string | null; description: string; category: string; amount_minor: number; currency: Currency;
  exchange_rate_to_uyu: number | null;
  payment_method: string | null; status: "pendiente" | "pagada"; invoice_number: string | null; notes: string | null;
};
type FixedExpense = {
  id: string; name: string; category: string; amount_minor: number; currency: Currency; due_day: number | null;
  payment_method: string | null; starts_on: string; ends_on: string | null; active: boolean; notes: string | null;
};
type FixedPayment = { id: string; fixed_expense_id: string; month: string; amount_minor: number; paid_on: string };
type ExpenseRow = {
  id: string; source: "purchase" | "fixed" | "opening"; sourceId: string; occurrenceMonth?: string;
  name: string; category: string; date: string | null; amount_minor: number; currency: Currency;
  supplier: string | null; overdue: boolean;
};

const today = montevideoToday();
const methods = ["Efectivo", "Transferencia", "Tarjeta de débito", "Tarjeta de crédito", "Mercado Pago", "Otro"];
const purchaseColumns = "id,purchased_on,due_on,paid_on,supplier,description,category,amount_minor,currency,exchange_rate_to_uyu,payment_method,status,invoice_number,notes";
const fixedColumns = "id,name,category,amount_minor,currency,due_day,payment_method,starts_on,ends_on,active,notes";
const paymentColumns = "id,fixed_expense_id,month,amount_minor,paid_on";
async function fixedPaymentRate(currency: Currency): Promise<number> {
  if (currency === "UYU") return 1;
  if (!commerceSource) throw new Error("El comercio no está conectado.");
  const { data, error } = await commerceSource.from("commerce_exchange_rates")
    .select("rate_to_uyu").eq("currency_code", currency).single();
  const rate = Number(data?.rate_to_uyu);
  if (error || !Number.isFinite(rate) || rate <= 0) throw new Error("No hay cotización para el gasto fijo.");
  return rate;
}
const toMinor = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const fromMinor = (value: number) => String(value / 100);
const monthEnd = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(2, "0")}`;
};
const nextMonth = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
};
const monthName = (month: string) => new Intl.DateTimeFormat("es-UY", { month: "long", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${month}-01T00:00:00Z`));
const amountLabel = financeAmountLabel;
const totals = (rows: { amount_minor: number; currency: Currency }[]) => {
  const byCurrency = { UYU: 0, USD: 0, ARS: 0 };
  rows.forEach((row) => { byCurrency[row.currency] += Number(row.amount_minor); });
  return (["UYU", "USD", "ARS"] as const).filter((currency) => byCurrency[currency] || currency === "UYU" && !byCurrency.USD && !byCurrency.ARS)
    .map((currency) => amountLabel(byCurrency[currency], currency)).join(" + ");
};

async function readAll<T>(table: "purchases" | "fixed_expenses" | "fixed_expense_payments" | "expense_categories", columns: string): Promise<T[]> {
  if (!commerceSource) throw new Error("El comercio no está conectado.");
  const rows: T[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await commerceSource.from(table).select(columns).range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    rows.push(...((data || []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function useExpenseData(notify: (message: string) => void) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const [payments, setPayments] = useState<FixedPayment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [openings, setOpenings] = useState<FinanceOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const [nextPurchases, nextFixed, nextPayments, nextCategories, nextOpenings] = await Promise.all([
        readAll<Purchase>("purchases", purchaseColumns),
        readAll<FixedExpense>("fixed_expenses", fixedColumns),
        readAll<FixedPayment>("fixed_expense_payments", paymentColumns),
        readAll<Category>("expense_categories", "id,name,kind,active"),
        readFinanceOpenings(),
      ]);
      setPurchases(nextPurchases);
      setFixed(nextFixed);
      setPayments(nextPayments);
      setCategories(nextCategories.filter((item) => item.active !== false));
      setOpenings(nextOpenings);
    } catch {
      notify("No se pudieron cargar los egresos.");
    } finally {
      setLoading(false);
    }
  }, [notify]);
  useEffect(() => { void load(); }, [load]);
  return { purchases, fixed, payments, categories, openings, loading, load, setCategories };
}

function CategoryField({ categories, kind, value, onChange, onCreated, editable }: {
  categories: Category[]; kind: "compra" | "gasto_fijo"; value: string;
  onChange: (value: string) => void; onCreated: (category: Category) => void; editable: boolean;
}) {
  const id = useId();
  const [newName, setNewName] = useState("");
  const options = categories.filter((item) => item.kind === "ambas" || item.kind === kind);
  const create = async () => {
    const name = newName.trim();
    if (!name || !commerceSource || !editable) return;
    const existing = categories.find((item) => item.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"));
    if (existing) { onChange(existing.name); setNewName(""); return; }
    const { data, error } = await commerceSource.from("expense_categories").insert({ name, kind }).select("id,name,kind").single();
    if (error || !data) return;
    onCreated(data as Category);
    onChange(name);
    setNewName("");
  };
  return <div className="finance-category-field">
    <label htmlFor={id}>Categoría</label>
    <select id={id} required value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="" disabled>Elegí una categoría</option>
      {options.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
      {value && !options.some((item) => item.name === value) && <option value={value}>{value}</option>}
    </select>
    {editable && <div className="finance-category-add"><input aria-label="Nueva categoría" maxLength={60} placeholder="Nueva categoría" value={newName} onChange={(event) => setNewName(event.target.value)} /><button type="button" className="secondary" onClick={() => void create()} disabled={!newName.trim()}>Agregar</button></div>}
  </div>;
}

type PurchaseForm = {
  purchased_on: string; due_on: string; paid_on: string; supplier: string; description: string; category: string;
  amount: string; currency: Currency; exchange_rate_to_uyu: string; payment_method: string;
  status: Purchase["status"]; invoice_number: string; notes: string;
};
const emptyPurchase = (): PurchaseForm => ({
  purchased_on: today, due_on: "", paid_on: today, supplier: "", description: "", category: "", amount: "",
  currency: "UYU", exchange_rate_to_uyu: "", payment_method: "", status: "pagada", invoice_number: "", notes: "",
});
const purchaseForm = (row: Purchase): PurchaseForm => ({
  purchased_on: row.purchased_on, due_on: row.due_on || "", paid_on: row.paid_on || row.purchased_on,
  supplier: row.supplier || "", description: row.description, category: row.category, amount: fromMinor(row.amount_minor),
  currency: row.currency, exchange_rate_to_uyu: row.exchange_rate_to_uyu == null ? "" : String(row.exchange_rate_to_uyu),
  payment_method: row.payment_method || "", status: row.status,
  invoice_number: row.invoice_number || "", notes: row.notes || "",
});

function rowsForMonth(purchases: Purchase[], fixed: FixedExpense[], payments: FixedPayment[], month: string) {
  const realized: ExpenseRow[] = [];
  const upcoming: ExpenseRow[] = [];
  const end = monthEnd(month);
  const paymentKeys = new Set(payments.map((item) => `${item.fixed_expense_id}:${item.month.slice(0, 7)}`));
  const fixedById = new Map(fixed.map((item) => [item.id, item]));
  for (const purchase of purchases) {
    const paid = purchase.status === "pagada";
    const date = paid ? purchase.paid_on || purchase.purchased_on : purchase.due_on;
    const row: ExpenseRow = {
      id: `purchase:${purchase.id}`, source: "purchase", sourceId: purchase.id, name: purchase.description,
      category: purchase.category, date, amount_minor: Number(purchase.amount_minor), currency: purchase.currency,
      supplier: purchase.supplier, overdue: !paid && Boolean(date && date < today),
    };
    if (paid && date?.startsWith(month)) realized.push(row);
    if (!paid && (!date || date <= end)) upcoming.push(row);
  }
  for (const payment of payments) {
    const template = fixedById.get(payment.fixed_expense_id);
    if (!template || !payment.paid_on.startsWith(month)) continue;
    realized.push({
      id: `fixed:${payment.id}`, source: "fixed", sourceId: template.id, occurrenceMonth: payment.month.slice(0, 7),
      name: template.name, category: template.category, date: payment.paid_on,
      amount_minor: Number(payment.amount_minor), currency: template.currency, supplier: null, overdue: false,
    });
  }
  for (const template of fixed) {
    if (!template.active) continue;
    const first = template.starts_on.slice(0, 7);
    for (let occurrence = first; occurrence <= month; occurrence = nextMonth(occurrence)) {
      if (template.ends_on && template.ends_on < `${occurrence}-01`) break;
      if (template.starts_on > monthEnd(occurrence) || paymentKeys.has(`${template.id}:${occurrence}`)) continue;
      const day = template.due_day ? Math.min(template.due_day, Number(monthEnd(occurrence).slice(-2))) : null;
      const date = day ? `${occurrence}-${String(day).padStart(2, "0")}` : null;
      upcoming.push({
        id: `fixed:${template.id}:${occurrence}`, source: "fixed", sourceId: template.id, occurrenceMonth: occurrence,
        name: template.name, category: template.category, date, amount_minor: Number(template.amount_minor),
        currency: template.currency, supplier: null, overdue: occurrence < month || Boolean(date && date < today),
      });
    }
  }
  realized.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  upcoming.sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.date || "9999").localeCompare(b.date || "9999"));
  return { realized, upcoming };
}

export function FinanceExpenses({ notify, editable, openingEditable }: { notify: (message: string) => void; editable: boolean; openingEditable: boolean }) {
  const { purchases, fixed, payments, categories, openings, loading, load, setCategories } = useExpenseData(notify);
  const [month, setMonth] = useState(() => {
    const requested = new URLSearchParams(location.search).get("mes");
    return requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : today.slice(0, 7);
  });
  const [view, setView] = useState<"realizados" | "proximos" | "todos">(
    () => new URLSearchParams(location.search).get("detalle") === "1" ? "todos"
      : new URLSearchParams(location.search).get("vista") === "proximos" ? "proximos" : "realizados",
  );
  const [categoryFilter, setCategoryFilter] = useState(() => new URLSearchParams(location.search).get("categoria") || "");
  const [detail, setDetail] = useState(() => new URLSearchParams(location.search).get("detalle") === "1");
  const [editing, setEditing] = useState<{ id: string | null; form: PurchaseForm } | null>(null);
  const [paying, setPaying] = useState<ExpenseRow | null>(null);
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingOpening, setEditingOpening] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const { realized, upcoming } = useMemo(() => rowsForMonth(purchases, fixed, payments, month), [purchases, fixed, payments, month]);
  const opening = openings.find((row) => row.month === month);
  const openingRow: ExpenseRow = { id: `opening:${month}`, source: "opening", sourceId: month,
    name: "Saldo final del mes anterior", category: "Saldo de arranque", date: `${month}-01`,
    amount_minor: opening?.amountMinor || 0, currency: "UYU", supplier: null, overdue: false };
  const set = <K extends keyof PurchaseForm>(key: K, value: PurchaseForm[K]) => setEditing((current) =>
    current && { ...current, form: { ...current.form, [key]: value } });
  const changePurchaseCurrency = (currency: Currency) => {
    setEditing((current) => current && { ...current, form: { ...current.form, currency, exchange_rate_to_uyu: "" } });
    if (currency === "UYU") return;
    void readCurrentFinanceRate(currency).then((rate) => setEditing((current) => current?.form.currency === currency
      ? { ...current, form: { ...current.form, exchange_rate_to_uyu: String(rate) } } : current))
      .catch(() => notify(`No se pudo cargar la cotización de ${currency}. Ingresala manualmente.`));
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !commerceSource || !editable) return;
    const { form, id } = editing;
    const amount_minor = toMinor(form.amount);
    const exchangeRate = form.currency === "UYU" ? null : Number(form.exchange_rate_to_uyu.replace(",", "."));
    if (!Number.isSafeInteger(amount_minor) || amount_minor <= 0 || (form.status === "pagada" && !form.paid_on) ||
      (form.currency !== "UYU" && (!Number.isFinite(exchangeRate) || !(exchangeRate! > 0)))) {
      notify("Ingresá un importe, una fecha de pago y una cotización válidos."); return;
    }
    const payload = {
      purchased_on: form.purchased_on, due_on: form.due_on || null, paid_on: form.status === "pagada" ? form.paid_on : null,
      supplier: form.supplier.trim() || null, description: form.description.trim(), category: form.category,
      amount_minor, currency: form.currency, exchange_rate_to_uyu: exchangeRate,
      payment_method: form.payment_method || null, status: form.status,
      invoice_number: form.invoice_number.trim() || null, notes: form.notes.trim() || null,
    };
    setSaving(true);
    const { error } = id ? await commerceSource.from("purchases").update(payload).eq("id", id)
      : await commerceSource.from("purchases").insert(payload);
    setSaving(false);
    if (error) { notify("No se pudo guardar el egreso."); return; }
    setEditing(null); await load(); notify(id ? "Egreso actualizado." : "Egreso agregado.");
  };
  const markPaid = async (event: FormEvent) => {
    event.preventDefault();
    if (!paying || !commerceSource || !editable) return;
    const amount_minor = toMinor(paymentAmount);
    if (!Number.isSafeInteger(amount_minor) || amount_minor <= 0) { notify("Ingresá un importe válido."); return; }
    setSaving(true);
    let exchange_rate_to_uyu = 1;
    if (paying.source === "fixed") {
      try { exchange_rate_to_uyu = await fixedPaymentRate(paying.currency); }
      catch { setSaving(false); notify("No se pudo consultar la cotización del gasto fijo."); return; }
    }
    const { error } = paying.source === "purchase"
      ? await commerceSource.from("purchases").update({ status: "pagada", paid_on: paymentDate, amount_minor }).eq("id", paying.sourceId)
      : await commerceSource.from("fixed_expense_payments").insert({
        fixed_expense_id: paying.sourceId, month: `${paying.occurrenceMonth}-01`, paid_on: paymentDate, amount_minor, exchange_rate_to_uyu,
      });
    setSaving(false);
    if (error) { notify("No se pudo registrar el pago."); return; }
    setPaying(null); await load(); notify("Pago registrado.");
  };
  const startPay = (row: ExpenseRow) => {
    setPaying(row); setPaymentDate(today); setPaymentAmount(fromMinor(row.amount_minor));
  };
  const saveOpening = async (event: FormEvent) => {
    event.preventDefault();
    const amountMinor = toMinor(openingAmount);
    if (!openingAmount.trim() || !Number.isSafeInteger(amountMinor)) {
      notify("Ingresá un saldo válido."); return;
    }
    setSaving(true);
    try {
      await saveFinanceOpening(month, amountMinor);
      await load();
      setEditingOpening(false);
      notify("Saldo de arranque guardado.");
    } catch { notify("No se pudo guardar el saldo de arranque."); }
    finally { setSaving(false); }
  };
  const rows = (view === "todos" ? [...realized, ...upcoming]
    : view === "realizados" ? month <= "2026-11" && !detail ? [openingRow, ...realized] : realized : upcoming)
    .filter((row) => (!detail || row.date?.startsWith(month)) && (!categoryFilter || row.category === categoryFilter));
  return <section className="finance-expenses">
    <div className="finance-expense-toolbar">
      <label>Mes<input type="month" value={month} onChange={(event) => {
        if (!event.target.value) return;
        setMonth(event.target.value);
        if (detail) history.replaceState(null, "", `/finanzas/egresos?mes=${event.target.value}&detalle=1${categoryFilter ? `&categoria=${encodeURIComponent(categoryFilter)}` : ""}`);
      }} /></label>
      <div className="finance-expense-tabs" role="tablist" aria-label="Estado de los egresos">
        {detail && <button type="button" role="tab" aria-selected={view === "todos"} className={view === "todos" ? "active" : ""} onClick={() => setView("todos")}>Todos</button>}
        <button type="button" role="tab" aria-selected={view === "realizados"} className={view === "realizados" ? "active" : ""} onClick={() => setView("realizados")}>Realizados</button>
        <button type="button" role="tab" aria-selected={view === "proximos"} className={view === "proximos" ? "active" : ""} onClick={() => setView("proximos")}>Próximos</button>
      </div>
    </div>
    {detail && <div className="finance-detail-filter">{categoryFilter ? `Categoría: ${categoryFilter}` : "Todos los egresos"}
      <button type="button" className="secondary" onClick={() => { setCategoryFilter(""); setDetail(false); setView("realizados"); history.replaceState(null, "", `/finanzas/egresos?mes=${month}`); }}>Quitar filtro</button></div>}
    {detail && categoryFilter === "Costos futuros estimados" && <div className="data-note">Esta fila es una estimación y no tiene egresos registrados.</div>}
    <Stats items={[
      { label: `Pagado en ${monthName(month)}`, value: totals(realized), tone: "red" },
      { label: "Por pagar hasta el mes seleccionado", value: totals(upcoming), tone: "yellow" },
    ]} />
    {view === "proximos" && <div className="data-note">También se muestran los pagos vencidos y los que todavía no tienen fecha prevista.</div>}
    {loading ? <div role="status">Cargando egresos…</div> : <Table rows={rows} title={view === "todos" ? "Egresos del mes" : view === "realizados" ? "Realizados" : "Próximos"}
      className="finance-expense-table"
      pageSize={50} searchText={(row) => `${row.name} ${row.category} ${row.supplier || ""}`}
      action={editable ? <button type="button" className="primary" onClick={() => setEditing({ id: null, form: emptyPurchase() })}>Agregar egreso</button> : undefined}
      columns={[
        { label: view === "proximos" ? "Vence" : "Fecha", render: (row) => row.date ? formatDate(row.date) : "Sin fecha prevista" },
        { label: "Concepto", render: (row) => <><strong>{row.name}</strong><small>{row.source === "opening" ? "Saldo usado para iniciar el mes" : row.source === "fixed" ? `Gasto fijo de ${monthName(row.occurrenceMonth!)}` : row.supplier || "Egreso variable"}</small></> },
        { label: "Categoría", render: (row) => <Badge>{row.category}</Badge> },
        { label: "Estado", render: (row) => <Badge tone={row.source === "opening" ? undefined : realized.some((paidRow) => paidRow.id === row.id) ? "green" : "yellow"}>{row.source === "opening" ? opening ? "Cargado" : "Sin cargar" : realized.some((paidRow) => paidRow.id === row.id) ? "Pagado" : row.overdue ? "Vencido" : "Pendiente"}</Badge> },
        { label: "Importe", render: (row) => <strong>{row.source === "opening" && !opening ? "—" : amountLabel(row.amount_minor, row.currency)}</strong> },
        ...(editable || openingEditable ? [{ label: "Acciones", render: (row: ExpenseRow) => <div className="finance-expense-actions">
          {row.source === "opening" && openingEditable && <button type="button" className={opening ? "secondary finance-expense-edit" : "secondary"} aria-label={opening ? "Editar saldo" : undefined} title={opening ? "Editar saldo" : undefined} onClick={() => { setOpeningAmount(opening ? fromMinor(opening.amountMinor) : ""); setEditingOpening(true); }}>{opening ? <PencilSimple size={18} aria-hidden="true" /> : "Cargar saldo"}</button>}
          {editable && view !== "realizados" && upcoming.some((pending) => pending.id === row.id) && <button type="button" className="secondary" onClick={() => startPay(row)}>Marcar pagado</button>}
          {editable && row.source === "purchase" && <button type="button" className="secondary finance-expense-edit" aria-label={`Editar ${row.name}`} title="Editar egreso" onClick={() => {
            const purchase = purchases.find((item) => item.id === row.sourceId);
            if (purchase) setEditing({ id: purchase.id, form: purchaseForm(purchase) });
          }}><PencilSimple size={18} aria-hidden="true" /></button>}
        </div> }] : []),
      ]} />}
    {editingOpening && <Modal title={`Saldo final del mes anterior, ${monthName(month)}`} onClose={() => setEditingOpening(false)}>
      <form className="finance-opening-form" onSubmit={(event) => void saveOpening(event)}>
        <label>Saldo de arranque en UYU<input type="number" inputMode="decimal" step="0.01" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} required autoFocus /></label>
        <div className="data-note">Este saldo inicia el cálculo mensual y no se suma a los egresos pagados.</div>
        <div className="form-actions"><button type="button" className="secondary" onClick={() => setEditingOpening(false)} disabled={saving}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar saldo"}</button></div>
      </form>
    </Modal>}
    {editing && <Modal title={editing.id ? "Editar egreso" : "Agregar egreso"} onClose={() => setEditing(null)}>
      <form className="finance-expense-form" onSubmit={save}>
        <label>Fecha del gasto<input type="date" required value={editing.form.purchased_on} onChange={(event) => set("purchased_on", event.target.value)} /></label>
        <label>Fecha prevista de pago<input type="date" value={editing.form.due_on} onChange={(event) => set("due_on", event.target.value)} /></label>
        <label className="wide">Concepto<input required maxLength={200} value={editing.form.description} onChange={(event) => set("description", event.target.value)} /></label>
        <label>Proveedor<input maxLength={120} value={editing.form.supplier} onChange={(event) => set("supplier", event.target.value)} /></label>
        <CategoryField categories={categories} kind="compra" value={editing.form.category} editable={editable} onChange={(value) => set("category", value)} onCreated={(category) => setCategories((current) => [...current, category])} />
        <label>Importe<input required inputMode="decimal" value={editing.form.amount} onChange={(event) => set("amount", event.target.value)} /></label>
        <label>Moneda<select value={editing.form.currency} onChange={(event) => changePurchaseCurrency(event.target.value as Currency)}><option value="UYU">UYU</option><option value="USD">USD</option><option value="ARS">ARS</option></select></label>
        {editing.form.currency !== "UYU" && <label>Cotización, UYU por {editing.form.currency}<input type="number" inputMode="decimal" min="0.00000001" step="any" required
          value={editing.form.exchange_rate_to_uyu} onChange={(event) => set("exchange_rate_to_uyu", event.target.value)} /></label>}
        <label>Medio de pago<select value={editing.form.payment_method} onChange={(event) => set("payment_method", event.target.value)}><option value="">Sin especificar</option>{methods.map((method) => <option key={method}>{method}</option>)}</select></label>
        <label>Estado<select value={editing.form.status} onChange={(event) => set("status", event.target.value as Purchase["status"])}><option value="pagada">Pagado</option><option value="pendiente">Pendiente</option></select></label>
        {editing.form.status === "pagada" && <label>Fecha de pago<input type="date" required value={editing.form.paid_on} onChange={(event) => set("paid_on", event.target.value)} /></label>}
        <label>Factura<input maxLength={60} value={editing.form.invoice_number} onChange={(event) => set("invoice_number", event.target.value)} /></label>
        <label className="wide">Notas<textarea rows={3} maxLength={1000} value={editing.form.notes} onChange={(event) => set("notes", event.target.value)} /></label>
        <div className="finance-expense-form-actions"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar egreso"}</button></div>
      </form>
    </Modal>}
    {paying && <Modal title={`Registrar pago: ${paying.name}`} onClose={() => setPaying(null)}>
      <form className="finance-expense-form" onSubmit={markPaid}>
        <label>Fecha de pago<input type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
        <label>Importe pagado<input required inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
        <div className="finance-expense-form-actions"><button type="button" className="secondary" onClick={() => setPaying(null)}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando…" : "Registrar pago"}</button></div>
      </form>
    </Modal>}
  </section>;
}

type FixedForm = {
  name: string; category: string; amount: string; currency: Currency; due_day: string; payment_method: string;
  starts_on: string; ends_on: string; active: boolean; notes: string;
};
const emptyFixed = (): FixedForm => ({
  name: "", category: "", amount: "", currency: "UYU", due_day: "", payment_method: "",
  starts_on: today, ends_on: "", active: true, notes: "",
});
export function FinanceFixedExpenses({ notify, editable }: { notify: (message: string) => void; editable: boolean }) {
  const { fixed, payments, categories, loading, load, setCategories } = useExpenseData(notify);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [editing, setEditing] = useState<{ id: string | null; form: FixedForm } | null>(null);
  const [saving, setSaving] = useState(false);
  const applicable = fixed.filter((item) => item.starts_on <= monthEnd(month) && (!item.ends_on || item.ends_on >= `${month}-01`));
  const paymentFor = (id: string) => payments.find((item) => item.fixed_expense_id === id && item.month.startsWith(month));
  const set = <K extends keyof FixedForm>(key: K, value: FixedForm[K]) => setEditing((current) =>
    current && { ...current, form: { ...current.form, [key]: value } });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !commerceSource || !editable) return;
    const { form, id } = editing;
    const amount_minor = toMinor(form.amount);
    if (!Number.isSafeInteger(amount_minor) || amount_minor <= 0 || form.ends_on && form.ends_on < form.starts_on) {
      notify("Revisá el importe y las fechas."); return;
    }
    const payload = {
      name: form.name.trim(), category: form.category, amount_minor, currency: form.currency,
      due_day: form.due_day ? Number(form.due_day) : null, payment_method: form.payment_method || null,
      starts_on: form.starts_on, ends_on: form.ends_on || null, active: form.active, notes: form.notes.trim() || null,
    };
    setSaving(true);
    const { error } = id ? await commerceSource.from("fixed_expenses").update(payload).eq("id", id)
      : await commerceSource.from("fixed_expenses").insert(payload);
    setSaving(false);
    if (error) { notify("No se pudo guardar el gasto fijo."); return; }
    setEditing(null); await load(); notify(id ? "Gasto fijo actualizado." : "Gasto fijo agregado.");
  };
  const togglePaid = async (row: FixedExpense) => {
    if (!editable || !commerceSource) return;
    const payment = paymentFor(row.id);
    if (payment && !confirm(`¿Deshacer el pago de ${row.name} en ${monthName(month)}?`)) return;
    let exchange_rate_to_uyu = 1;
    if (!payment) {
      try { exchange_rate_to_uyu = await fixedPaymentRate(row.currency); }
      catch { notify("No se pudo consultar la cotización del gasto fijo."); return; }
    }
    const { error } = payment ? await commerceSource.from("fixed_expense_payments").delete().eq("id", payment.id)
      : await commerceSource.from("fixed_expense_payments").insert({
        fixed_expense_id: row.id, month: `${month}-01`, amount_minor: row.amount_minor, paid_on: today, exchange_rate_to_uyu,
      });
    if (error) { notify("No se pudo actualizar el pago."); return; }
    await load(); notify(payment ? "Pago deshecho." : "Pago registrado.");
  };
  return <section className="finance-expenses">
    <div className="finance-expense-toolbar"><label>Mes<input type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} /></label></div>
    <Stats items={[
      { label: `Gastos fijos de ${monthName(month)}`, value: totals(applicable.filter((item) => item.active)), tone: "red" },
      { label: "Pagado", value: totals(applicable.flatMap((item) => {
        const payment = paymentFor(item.id);
        return payment ? [{ amount_minor: payment.amount_minor, currency: item.currency }] : [];
      })), tone: "green" },
    ]} />
    {loading ? <div role="status">Cargando gastos fijos…</div> : <Table rows={applicable} title="Gastos fijos" pageSize={50}
      searchText={(row) => `${row.name} ${row.category} ${row.notes || ""}`}
      action={editable ? <button type="button" className="primary" onClick={() => setEditing({ id: null, form: emptyFixed() })}>Agregar gasto fijo</button> : undefined}
      columns={[
        { label: "Concepto", render: (row) => <><strong>{row.name}</strong>{!row.active && <small>Inactivo</small>}</> },
        { label: "Categoría", render: (row) => <Badge>{row.category}</Badge> },
        { label: "Vence", render: (row) => row.due_day ? `Día ${row.due_day}` : "Sin día definido" },
        { label: "Importe", render: (row) => <strong>{amountLabel(row.amount_minor, row.currency)}</strong> },
        { label: "Estado", render: (row) => <Badge tone={paymentFor(row.id) ? "green" : "yellow"}>{paymentFor(row.id) ? `Pagado ${formatDate(paymentFor(row.id)!.paid_on)}` : "Pendiente"}</Badge> },
        ...(editable ? [{ label: "Acciones", render: (row: FixedExpense) => <div className="finance-expense-actions">
          <button type="button" className="secondary" onClick={() => void togglePaid(row)}>{paymentFor(row.id) ? "Deshacer pago" : "Marcar pagado"}</button>
          <button type="button" className="secondary" onClick={() => setEditing({ id: row.id, form: {
            name: row.name, category: row.category, amount: fromMinor(row.amount_minor), currency: row.currency,
            due_day: row.due_day ? String(row.due_day) : "", payment_method: row.payment_method || "",
            starts_on: row.starts_on, ends_on: row.ends_on || "", active: row.active, notes: row.notes || "",
          } })}>Editar</button>
        </div> }] : []),
      ]} />}
    {editing && <Modal title={editing.id ? "Editar gasto fijo" : "Agregar gasto fijo"} onClose={() => setEditing(null)}>
      <form className="finance-expense-form" onSubmit={save}>
        <label className="wide">Concepto<input required maxLength={120} value={editing.form.name} onChange={(event) => set("name", event.target.value)} /></label>
        <CategoryField categories={categories} kind="gasto_fijo" value={editing.form.category} editable={editable} onChange={(value) => set("category", value)} onCreated={(category) => setCategories((current) => [...current, category])} />
        <label>Importe mensual<input required inputMode="decimal" value={editing.form.amount} onChange={(event) => set("amount", event.target.value)} /></label>
        <label>Moneda<select value={editing.form.currency} onChange={(event) => set("currency", event.target.value as Currency)}><option value="UYU">UYU</option><option value="USD">USD</option></select></label>
        <label>Día de vencimiento<input type="number" min="1" max="31" value={editing.form.due_day} onChange={(event) => set("due_day", event.target.value)} /></label>
        <label>Medio de pago<select value={editing.form.payment_method} onChange={(event) => set("payment_method", event.target.value)}><option value="">Sin especificar</option>{methods.map((method) => <option key={method}>{method}</option>)}</select></label>
        <label>Rige desde<input type="date" required value={editing.form.starts_on} onChange={(event) => set("starts_on", event.target.value)} /></label>
        <label>Rige hasta<input type="date" value={editing.form.ends_on} onChange={(event) => set("ends_on", event.target.value)} /></label>
        <label className="finance-expense-check"><input type="checkbox" checked={editing.form.active} onChange={(event) => set("active", event.target.checked)} />Activo</label>
        <label className="wide">Notas<textarea rows={3} maxLength={1000} value={editing.form.notes} onChange={(event) => set("notes", event.target.value)} /></label>
        <div className="finance-expense-form-actions"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar gasto fijo"}</button></div>
      </form>
    </Modal>}
  </section>;
}
