import { useEffect, useState, type FormEvent } from "react";
import { money, orderName, type State } from "./data";
import { formatDate } from "./dateFormat";
import { montevideoToday } from "./overview";
import { Modal, Stats, Table } from "./ui";
import { addFinanceIncomeCategory, addFinanceManualIncome, readFinanceIncome, type FinanceManualIncome } from "./financeIncomeSource";
import { financeAmountLabel, financeUyuMinor, readCurrentFinanceRate, type FinanceCurrency } from "./financeCurrency";
import "./financeIncome.css";

type IncomeDetail = { id: string; date: string; concept: string; category: string; amount: number };

export function FinanceIncome({ notify, editable, s }: { notify: (message: string) => void; editable: boolean; s: State }) {
  const [categories, setCategories] = useState<string[]>([]);
  const [incomes, setIncomes] = useState<FinanceManualIncome[]>([]);
  const [month, setMonth] = useState(() => {
    const requested = new URLSearchParams(location.search).get("mes");
    return requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : montevideoToday().slice(0, 7);
  });
  const [detail, setDetail] = useState(() => new URLSearchParams(location.search).get("detalle") === "1");
  const [categoryFilter, setCategoryFilter] = useState(() => new URLSearchParams(location.search).get("categoria") || "");
  const [receivedOn, setReceivedOn] = useState(montevideoToday());
  const [category, setCategory] = useState("Ingresos extraordinarios");
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<FinanceCurrency>("UYU");
  const [exchangeRate, setExchangeRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openEditor = () => {
    setReceivedOn(montevideoToday());
    setDescription("");
    setAmount("");
    setCurrency("UYU");
    setExchangeRate("");
    setNewCategory("");
    setNewCategoryOpen(false);
    setEditing(true);
  };
  const closeEditor = () => { setEditing(false); setNewCategoryOpen(false); setNewCategory(""); };

  useEffect(() => {
    let active = true;
    void readFinanceIncome().then((result) => {
      if (!active) return;
      setCategories(result.categories);
      setIncomes(result.incomes);
      if (!result.categories.includes(category)) setCategory(result.categories[0] || "");
      setError("");
    }).catch(() => { if (active) setError("No se pudieron cargar los ingresos."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!editing || currency === "UYU") { setExchangeRate(""); return; }
    let active = true;
    setExchangeRate("");
    void readCurrentFinanceRate(currency).then((rate) => { if (active) setExchangeRate(String(rate)); })
      .catch(() => { if (active) notify(`No se pudo cargar la cotización de ${currency}. Ingresala manualmente.`); });
    return () => { active = false; };
  }, [currency, editing, notify]);

  const createCategory = async () => {
    const name = newCategory.trim();
    if (!editable || !name || saving) return;
    if (categories.some((item) => item.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) {
      notify("Esa categoría ya existe."); return;
    }
    setSaving(true);
    try {
      await addFinanceIncomeCategory(name);
      setCategories((current) => [...current, name]);
      setCategory(name);
      setNewCategory("");
      setNewCategoryOpen(false);
      notify("Categoría agregada.");
    } catch { notify("No se pudo agregar la categoría."); }
    finally { setSaving(false); }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editable || saving) return;
    const amountMinor = Math.round(Number(amount.replace(",", ".")) * 100);
    const rate = currency === "UYU" ? null : Number(exchangeRate.replace(",", "."));
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !description.trim() || !category ||
      (currency !== "UYU" && (!Number.isFinite(rate) || !(rate! > 0)))) {
      notify("Revisá el concepto, la categoría, el importe y la cotización."); return;
    }
    setSaving(true);
    try {
      const saved = await addFinanceManualIncome({ receivedOn, category, description: description.trim(), amountMinor,
        currency, exchangeRateToUyu: rate });
      setIncomes((current) => [saved, ...current]);
      setMonth(saved.receivedOn.slice(0, 7));
      setDescription("");
      setAmount("");
      closeEditor();
      notify("Ingreso registrado.");
    } catch { notify("No se pudo registrar el ingreso."); }
    finally { setSaving(false); }
  };

  const visible = incomes.filter((item) => item.receivedOn.startsWith(month) && (!categoryFilter || item.category === categoryFilter));
  const historical = s.orders.filter((order) => order.source === "wholesale" && order.wholesaleHistoricalPaidAtOrder
    && !order.consignmentId && order.wholesaleTotalUyu != null);
  const historicalIds = new Set(historical.map((order) => order.id));
  const historicalSaleIds = new Set(historical.map((order) => order.wholesaleSaleId).filter(Boolean));
  const historicalAllocations = new Map<string, number>();
  for (const allocation of s.accountAllocations || []) {
    if (!historicalSaleIds.has(allocation.orderId)) continue;
    historicalAllocations.set(allocation.receiptId, (historicalAllocations.get(allocation.receiptId) || 0) + allocation.amountMinor / 100);
  }
  const orderById = new Map(s.orders.map((order) => [order.id, order]));
  const movementRows: IncomeDetail[] = [
    ...incomes.filter((item) => item.receivedOn.startsWith(month)).map((item) => ({
      id: `manual:${item.id}`, date: item.receivedOn, concept: item.description, category: item.category,
      amount: (financeUyuMinor(item.amountMinor, item.currency, item.exchangeRateToUyu) || 0) / 100,
    })),
    ...s.payments.filter((payment) => payment.date.startsWith(month) && !historicalIds.has(payment.orderId))
      .map((payment) => {
        const order = orderById.get(payment.orderId);
        const category = payment.accountReceiptId ? "Entregas a cuenta"
          : payment.id.startsWith("wholesale-receipt:") || order?.source === "wholesale" ? "Ventas mayoristas"
            : payment.id.startsWith("local:") || payment.id.startsWith("local-receipt:") || order?.source === "local" ? "Ventas locales" : "Ventas web";
        const allocated = payment.accountReceiptId ? Math.min(payment.amount || 0, historicalAllocations.get(payment.accountReceiptId) || 0) : 0;
        return { id: payment.id, date: payment.date, concept: order ? `${orderName(order)} ${order.customerName || ""}`.trim() : "Cobro a cuenta",
          category, amount: (payment.amount || 0) - allocated };
      }).filter((row) => row.amount > 0),
    ...historical.filter((order) => order.date.startsWith(month)).map((order) => ({
      id: `historical:${order.id}`, date: order.date, concept: `${orderName(order)} ${order.customerName || ""}`.trim(),
      category: "Ventas mayoristas", amount: order.wholesaleTotalUyu || 0,
    })),
    ...s.orders.filter((order) => order.source === "wholesale" && !order.wholesaleHistoricalPaidAtOrder
      && !order.consignmentId && order.date.startsWith(month) && (order.wholesaleOpeningPaid || 0) > 0)
      .map((order) => ({ id: `opening:${order.id}`, date: order.date,
        concept: `${orderName(order)} ${order.customerName || ""}`.trim(), category: "Ventas mayoristas",
        amount: order.wholesaleOpeningPaid || 0 })),
  ].filter((row) => !categoryFilter || row.category === categoryFilter)
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = detail ? movementRows.reduce((sum, item) => sum + item.amount, 0) * 100
    : visible.reduce((sum, item) => sum + (financeUyuMinor(item.amountMinor, item.currency, item.exchangeRateToUyu) || 0), 0);
  return <section className="finance-manual-income">
    {error && <div role="alert" className="error">{error}</div>}
    <div className="finance-manual-income-toolbar"><label>Mes<input type="month" value={month} onChange={(event) => {
      if (!event.target.value) return;
      setMonth(event.target.value);
      if (detail) history.replaceState(null, "", `/finanzas/ingresos?mes=${event.target.value}&detalle=1${categoryFilter ? `&categoria=${encodeURIComponent(categoryFilter)}` : ""}`);
    }} /></label></div>
    {detail && <div className="finance-detail-filter">{categoryFilter ? `Categoría: ${categoryFilter}` : "Todos los ingresos"}
      <button type="button" className="secondary" onClick={() => { setCategoryFilter(""); setDetail(false); history.replaceState(null, "", `/finanzas/ingresos?mes=${month}`); }}>Quitar filtro</button></div>}
    {detail && categoryFilter === "Ventas futuras estimadas" && <div className="data-note">Esta fila es una estimación y no tiene cobros registrados.</div>}
    <Stats items={[{ label: "Ingresos del mes en UYU", value: money(total / 100), tone: "green" }]} />
    {loading ? <div role="status">Cargando ingresos…</div> : detail ? <Table rows={movementRows} title="Ingresos del mes" className="finance-manual-income-table" pageSize={50}
      searchText={(item) => `${item.concept} ${item.category} ${item.date}`}
      columns={[
        { label: "Fecha", render: (item) => formatDate(item.date) },
        { label: "Concepto", render: (item) => <strong>{item.concept}</strong> },
        { label: "Categoría", render: (item) => item.category },
        { label: "Importe UYU", render: (item) => <strong>{money(item.amount)}</strong> },
      ]} /> : <Table rows={visible} title="Ingresos registrados" className="finance-manual-income-table" pageSize={50}
      searchText={(item) => `${item.description} ${item.category} ${item.receivedOn}`}
      action={editable ? <button type="button" className="primary" onClick={openEditor}>Agregar ingreso</button> : undefined}
      columns={[
        { label: "Fecha", render: (item) => formatDate(item.receivedOn) },
        { label: "Concepto", render: (item) => <strong>{item.description}</strong> },
        { label: "Categoría", render: (item) => item.category },
        { label: "Importe", render: (item) => <strong>{financeAmountLabel(item.amountMinor, item.currency)}</strong> },
      ]} />}
    {editing && <Modal title="Agregar ingreso" className="finance-income-dialog" onClose={closeEditor}>
      <form className="finance-manual-income-form" onSubmit={(event) => void save(event)}>
        <label>Fecha de cobro<input type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} required /></label>
        <div className="finance-manual-income-category">
          <label htmlFor="finance-manual-income-category">Categoría</label>
          <div className="finance-manual-income-category-row">
            <select id="finance-manual-income-category" value={category} onChange={(event) => setCategory(event.target.value)} required>
              {categories.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <button type="button" className="secondary" onClick={() => setNewCategoryOpen((current) => !current)}>Nueva categoría</button>
          </div>
          {newCategoryOpen && <div className="finance-manual-income-category-add">
            <input aria-label="Nueva categoría de ingreso" placeholder="Nombre de la categoría" maxLength={60} value={newCategory} onChange={(event) => setNewCategory(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void createCategory(); } }} />
            <button type="button" className="secondary" disabled={saving || !newCategory.trim()} onClick={() => void createCategory()}>Agregar categoría</button>
          </div>}
        </div>
        <label className="wide">Concepto<input maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} required /></label>
        <label>Importe<input type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <label>Moneda<select value={currency} onChange={(event) => setCurrency(event.target.value as FinanceCurrency)}>
          <option value="UYU">UYU</option><option value="USD">USD</option><option value="ARS">ARS</option>
        </select></label>
        {currency !== "UYU" && <label>Cotización, UYU por {currency}<input type="number" min="0.00000001" step="any" inputMode="decimal"
          value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} required /></label>}
        <div className="finance-manual-income-actions"><button type="button" className="secondary" onClick={closeEditor} disabled={saving}>Cancelar</button>
          <button type="submit" className="primary" disabled={saving || loading || !categories.length}>{saving ? "Guardando…" : "Guardar ingreso"}</button></div>
      </form>
    </Modal>}
  </section>;
}
