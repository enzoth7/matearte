import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { accessUserId } from "./access";
import { commerceSource } from "./commerceSource";
import { money, type State } from "./data";
import { readExpenseSources, type ExpenseSources } from "./expenseSource";
import {
  buildFinanceCashEntries, calculateFinanceClose, firstFinanceCloseMonth, monthEnd, previousMonth,
  sameFinanceEntries, type FinanceAccount, type FinanceAdjustment, type FinanceBalance,
  type FinanceCloseRecord, type FinanceCurrency,
} from "./financeCloseModel";
import { montevideoToday } from "./overview";
import { Badge, Table } from "./ui";
import "./financeReconciliation.css";

const today = montevideoToday();
const formatMinor = (minor: number | null) => minor === null ? "—" : money(minor / 100);
const currencyAmount = (minor: number, currency: FinanceCurrency) =>
  new Intl.NumberFormat("es-UY", { style: "currency", currency, currencyDisplay: "code" }).format(minor / 100);
const monthLabel = (month: string) => new Intl.DateTimeFormat("es-UY", { month: "long", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${month}-01T00:00:00Z`));
const kindLabel = { bank: "Banco", cash: "Efectivo", wallet: "Billetera" };
const toMinor = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const monthOf = (row: FinanceCloseRecord) => row.month.slice(0, 7);

async function readCloseRecords(): Promise<FinanceCloseRecord[]> {
  if (!commerceSource) throw new Error("Sin conexión");
  const rows: FinanceCloseRecord[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await commerceSource.from("finance_monthly_closes")
      .select("id,month,revision,status,reason,balances,adjustments,rates,entries,opening_balances,summary,created_at,closed_at")
      .order("month", { ascending: false }).order("revision", { ascending: false }).range(page * 500, page * 500 + 499);
    if (error) throw error;
    rows.push(...((data || []) as FinanceCloseRecord[]));
    if (!data || data.length < 500) break;
  }
  return rows;
}

export function FinanceReconciliation({ s, notify, refresh }: {
  s: State; notify: (message: string) => void; refresh?: () => Promise<void>;
}) {
  const owner = accessUserId(s) === "t1";
  const [month, setMonth] = useState(() => today.slice(0, 7) < firstFinanceCloseMonth ? firstFinanceCloseMonth : today.slice(0, 7));
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [closes, setCloses] = useState<FinanceCloseRecord[]>([]);
  const [expenseSources, setExpenseSources] = useState<ExpenseSources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>({});
  const [adjustments, setAdjustments] = useState<FinanceAdjustment[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({ UYU: "1" });
  const [accountName, setAccountName] = useState("");
  const [accountKind, setAccountKind] = useState<FinanceAccount["kind"]>("bank");
  const [accountCurrency, setAccountCurrency] = useState<FinanceCurrency>("UYU");
  const [adjustmentKind, setAdjustmentKind] = useState<FinanceAdjustment["kind"]>("aporte");
  const [adjustmentCurrency, setAdjustmentCurrency] = useState<FinanceCurrency>("UYU");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [reason, setReason] = useState("");
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [revising, setRevising] = useState(false);
  const [saving, setSaving] = useState(false);
  const rateSignature = JSON.stringify(s.records.monedas || []);

  const load = useCallback(async () => {
    if (!commerceSource) { setError("El comercio no está conectado."); setLoading(false); return; }
    try {
      const [accountResult, nextCloses, sources] = await Promise.all([
        commerceSource.from("finance_accounts").select("id,name,kind,currency").order("created_at"),
        readCloseRecords(),
        readExpenseSources(commerceSource),
      ]);
      if (accountResult.error) throw accountResult.error;
      if (!sources) throw new Error("No se pudieron leer los movimientos del mes.");
      setAccounts((accountResult.data || []) as FinanceAccount[]);
      setCloses(nextCloses);
      setExpenseSources(sources);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la conciliación.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const monthCloses = useMemo(() => closes.filter((row) => monthOf(row) === month), [closes, month]);
  const latestClosed = monthCloses.filter((row) => row.status === "closed").sort((a, b) => b.revision - a.revision)[0];
  const draft = monthCloses.find((row) => row.status === "draft");
  const previousClosed = closes.filter((row) => monthOf(row) === previousMonth(month) && row.status === "closed")
    .sort((a, b) => b.revision - a.revision)[0];
  const selectedClosed = selectedRevision === null ? latestClosed
    : monthCloses.find((row) => row.status === "closed" && row.revision === selectedRevision) || latestClosed;
  const editing = owner && (!latestClosed || revising || Boolean(draft && selectedRevision === null));
  const reviewing = Boolean(selectedClosed && !editing);
  const openingBalances: FinanceBalance[] | null = month === firstFinanceCloseMonth ? []
    : previousClosed ? previousClosed.balances : null;
  const { entries, unknownAmounts } = useMemo(
    () => expenseSources ? buildFinanceCashEntries(month, s.payments, expenseSources) : { entries: [], unknownAmounts: 0 },
    [month, s.payments, expenseSources],
  );

  useEffect(() => {
    const base = draft || latestClosed;
    setBalanceInputs(Object.fromEntries(accounts.map((account) => {
      const saved = base?.balances.find((balance) => balance.id === account.id);
      return [account.id, saved ? String(saved.amount_minor / 100) : ""];
    })));
    setAdjustments(base?.adjustments || []);
    const currentRates = Object.fromEntries((s.records.monedas || []).map((row) => [String(row.moneda), String(row.valor)]));
    setRates({ UYU: "1", ...currentRates, ...Object.fromEntries(Object.entries(base?.rates || {}).map(([key, value]) => [key, String(value)])) });
    setReason("");
    setRevising(Boolean(draft && latestClosed));
    setSelectedRevision(null);
  }, [month, accounts, closes, rateSignature]);

  const providedBalances = accounts.flatMap((account): FinanceBalance[] => {
    const value = balanceInputs[account.id];
    if (value === undefined || value.trim() === "") return [];
    const amount_minor = toMinor(value);
    return Number.isSafeInteger(amount_minor) && amount_minor >= 0 ? [{ ...account, amount_minor }] : [];
  });
  const balancesComplete = accounts.length > 0 && providedBalances.length === accounts.length;
  const numericRates = Object.fromEntries(Object.entries(rates).map(([key, value]) => [key, Number(value.replace(",", "."))]));
  const liveSummary = calculateFinanceClose(providedBalances, openingBalances, adjustments, entries, numericRates);
  const shownRecord = reviewing ? selectedClosed : null;
  const shownBalances = shownRecord?.balances || providedBalances;
  const shownAdjustments = shownRecord?.adjustments || adjustments;
  const shownRates = shownRecord?.rates || numericRates;
  const shownEntries = shownRecord?.entries || entries;
  const summary = shownRecord?.summary || liveSummary;
  const balanceMissing = !reviewing && !balancesComplete;
  const stale = Boolean(shownRecord && !sameFinanceEntries(shownRecord.entries, entries));
  const usedCurrencies = [...new Set<FinanceCurrency>([
    ...accounts.map((row) => row.currency),
    ...shownEntries.map((row) => row.currency),
    ...shownAdjustments.map((row) => row.currency),
    ...(openingBalances || []).map((row) => row.currency),
  ])].filter((currency) => currency !== "UYU");

  const addAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!owner || !commerceSource || !accountName.trim()) return;
    setSaving(true);
    const { error: saveError } = await commerceSource.from("finance_accounts")
      .insert({ name: accountName.trim(), kind: accountKind, currency: accountCurrency });
    setSaving(false);
    if (saveError) { setError("No se pudo agregar la cuenta. Revisá si ya existe."); return; }
    setAccountName(""); await load(); notify("Cuenta agregada.");
  };
  const addAdjustment = (event: FormEvent) => {
    event.preventDefault();
    const amount_minor = toMinor(adjustmentAmount);
    if (!Number.isSafeInteger(amount_minor) || amount_minor <= 0 || !adjustmentNote.trim()) {
      setError("Ingresá un importe y un motivo para el ajuste."); return;
    }
    setAdjustments((current) => [...current, {
      id: crypto.randomUUID(), kind: adjustmentKind, currency: adjustmentCurrency, amount_minor, note: adjustmentNote.trim(),
    }]);
    setAdjustmentAmount(""); setAdjustmentNote(""); setError("");
  };
  const saveClose = async (finalize: boolean) => {
    if (!owner || !commerceSource || !expenseSources) return;
    if (finalize && montevideoToday() < monthEnd(month)) { setError("El cierre se puede finalizar desde el último día del mes."); return; }
    if (finalize && (!balancesComplete || unknownAmounts || liveSummary.missing_currencies.length || openingBalances === null)) {
      setError("Completá los saldos, cotizaciones y movimientos antes de finalizar."); return;
    }
    if (finalize && latestClosed && !reason.trim()) { setError("Ingresá el motivo de la corrección."); return; }
    if (finalize) {
      const freshSources = await readExpenseSources(commerceSource);
      if (!freshSources) { setError("No se pudieron verificar los egresos antes de cerrar."); return; }
      const freshEntries = buildFinanceCashEntries(month, s.payments, freshSources);
      if (freshEntries.unknownAmounts !== unknownAmounts || !sameFinanceEntries(freshEntries.entries, entries)) {
        setExpenseSources(freshSources);
        setError("Los egresos cambiaron. Revisá los importes actualizados y volvé a finalizar.");
        return;
      }
    }
    const revision = finalize ? (latestClosed?.revision || 0) + 1 : 0;
    const payload = {
      month: `${month}-01`, revision, status: finalize ? "closed" : "draft",
      reason: finalize && revision > 1 ? reason.trim() : null,
      balances: providedBalances, adjustments, rates: numericRates, entries,
      opening_balances: openingBalances || [], summary: liveSummary,
      closed_at: finalize ? new Date().toISOString() : null,
    };
    setSaving(true); setError("");
    const { error: saveError } = finalize || !draft
      ? await commerceSource.from("finance_monthly_closes").insert(payload)
      : await commerceSource.from("finance_monthly_closes").update(payload).eq("id", draft.id);
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    if (finalize && draft) {
      const { error: draftDeleteError } = await commerceSource.from("finance_monthly_closes").delete().eq("id", draft.id);
      if (draftDeleteError) setError("El cierre quedó finalizado, pero no se pudo quitar el borrador anterior.");
    }
    setRevising(false); await load();
    notify(finalize ? "Conciliación finalizada." : "Borrador guardado.");
  };
  const refreshAll = async () => { await refresh?.(); await load(); };
  if (loading) return <div role="status">Cargando conciliación…</div>;
  return <section className="finance-close">
    <div className="finance-close-top">
      <label>Mes<input type="month" min={firstFinanceCloseMonth} value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} /></label>
      <button type="button" className="secondary" onClick={() => void refreshAll()}>Actualizar movimientos</button>
    </div>
    {error && <div className="error" role="alert">{error}</div>}
    {month === firstFinanceCloseMonth && <div className="data-note">Noviembre de 2026 comienza con saldo inicial cero. La diferencia puede incluir dinero que ya existía antes de este mes.</div>}
    {month > firstFinanceCloseMonth && openingBalances === null && <div className="data-note">Para comparar saldos, primero hay que finalizar {monthLabel(previousMonth(month))}.</div>}
    {unknownAmounts > 0 && <div className="error" role="alert">Hay {unknownAmounts} movimientos sin importe o moneda válida. Revisalos antes de cerrar.</div>}
    {stale && <div className="data-note">Los movimientos registrados cambiaron desde este cierre. La versión guardada sigue intacta; Richard puede preparar una corrección.</div>}
    {reviewing && selectedClosed && <div className="finance-close-status">
      <Badge tone="green">Cerrado, versión {selectedClosed.revision}</Badge>
      <div>Finalizado el {new Date(selectedClosed.closed_at || selectedClosed.created_at).toLocaleString("es-UY", { timeZone: "America/Montevideo" })}</div>
      {selectedClosed.reason && <div>Motivo: {selectedClosed.reason}</div>}
      {owner && selectedClosed.revision === latestClosed?.revision && <button type="button" className="secondary" onClick={() => { setRevising(true); setSelectedRevision(null); }}>Preparar corrección</button>}
    </div>}
    <div className="finance-close-kpis">
      <div><div>Resultado de caja</div><strong className={(summary.result_uyu_minor || 0) < 0 ? "negative" : ""}>{formatMinor(summary.result_uyu_minor)}</strong><small>Cobros efectivos menos egresos pagados</small></div>
      <div><div>Saldo esperado</div><strong>{formatMinor(summary.expected_uyu_minor)}</strong><small>Saldo inicial, resultado y ajustes</small></div>
      <div><div>Saldo contado</div><strong>{balanceMissing ? "—" : formatMinor(summary.actual_uyu_minor)}</strong><small>Bancos, efectivo y billeteras</small></div>
      <div><div>Diferencia de conciliación</div><strong className={(summary.difference_uyu_minor || 0) < 0 ? "negative" : ""}>{balanceMissing ? "—" : formatMinor(summary.difference_uyu_minor)}</strong><small>Contado menos esperado</small></div>
    </div>
    <div className="finance-close-breakdown">
      <div>Cobros registrados <strong>{formatMinor(summary.income_uyu_minor)}</strong></div>
      <div>Egresos pagados <strong>{formatMinor(summary.expense_uyu_minor)}</strong></div>
      <div>Aportes y retiros netos <strong>{formatMinor(summary.adjustment_uyu_minor)}</strong></div>
      <div>Saldo inicial <strong>{formatMinor(summary.opening_uyu_minor)}</strong></div>
    </div>
    <section className="finance-close-panel">
      <header><h2>Saldos por cuenta</h2><small>Se comparan los totales combinados, no cada cuenta por separado.</small></header>
      {accounts.map((account) => {
        const savedBalance = shownBalances.find((balance) => balance.id === account.id);
        return <label className="finance-close-account" key={account.id}>
          <div><strong>{account.name}</strong><small>{kindLabel[account.kind]}, {account.currency}</small></div>
          {editing ? <input type="number" inputMode="decimal" step="0.01" min="0" aria-label={`Saldo de ${account.name} en ${account.currency}`} value={balanceInputs[account.id] ?? ""} onChange={(event) => setBalanceInputs((current) => ({ ...current, [account.id]: event.target.value }))} />
            : <strong>{savedBalance ? currencyAmount(savedBalance.amount_minor, account.currency) : "Sin saldo cargado"}</strong>}
        </label>;
      })}
      {!accounts.length && <div className="data-note">Agregá las cuentas bancarias, el efectivo y las billeteras que se van a contar.</div>}
      {editing && <form className="finance-close-add-account" onSubmit={(event) => void addAccount(event)}>
        <input aria-label="Nombre de la cuenta" maxLength={120} placeholder="Nombre de la cuenta" value={accountName} onChange={(event) => setAccountName(event.target.value)} required />
        <select aria-label="Tipo de cuenta" value={accountKind} onChange={(event) => setAccountKind(event.target.value as FinanceAccount["kind"])}><option value="bank">Banco</option><option value="cash">Efectivo</option><option value="wallet">Billetera</option></select>
        <select aria-label="Moneda de la cuenta" value={accountCurrency} onChange={(event) => setAccountCurrency(event.target.value as FinanceCurrency)}><option value="UYU">UYU</option><option value="USD">USD</option><option value="ARS">ARS</option></select>
        <button type="submit" className="secondary" disabled={saving}>Agregar cuenta</button>
      </form>}
    </section>
    {usedCurrencies.length > 0 && <section className="finance-close-panel">
      <h2>Cotizaciones del cierre</h2>
      <div className="finance-close-rates">{usedCurrencies.map((currency) => <label key={currency}>UYU por {currency}
        {editing ? <input type="number" min="0.000001" step="any" value={rates[currency] || ""} onChange={(event) => setRates((current) => ({ ...current, [currency]: event.target.value }))} />
          : <strong>{Number(shownRates[currency] || 0).toLocaleString("es-UY", { maximumFractionDigits: 6 })}</strong>}
      </label>)}</div>
      {!reviewing && liveSummary.missing_currencies.length > 0 && <div className="error">Falta la cotización de: {liveSummary.missing_currencies.join(", ")}.</div>}
    </section>}
    <section className="finance-close-panel">
      <h2>Aportes y retiros</h2>
      <div className="data-note">Ajustan el saldo esperado, pero no el Resultado de caja.</div>
      {shownAdjustments.map((item) => <div className="finance-close-adjustment" key={item.id}>
        <div><strong>{item.kind === "aporte" ? "Aporte" : "Retiro"}</strong><small>{item.note}</small></div>
        <strong>{currencyAmount(item.amount_minor, item.currency)}</strong>
        {editing && <button type="button" className="secondary" onClick={() => setAdjustments((current) => current.filter((row) => row.id !== item.id))}>Quitar</button>}
      </div>)}
      {editing && <form className="finance-close-add-adjustment" onSubmit={addAdjustment}>
        <select aria-label="Tipo de ajuste" value={adjustmentKind} onChange={(event) => setAdjustmentKind(event.target.value as FinanceAdjustment["kind"])}><option value="aporte">Aporte</option><option value="retiro">Retiro</option></select>
        <select aria-label="Moneda del ajuste" value={adjustmentCurrency} onChange={(event) => setAdjustmentCurrency(event.target.value as FinanceCurrency)}><option value="UYU">UYU</option><option value="USD">USD</option><option value="ARS">ARS</option></select>
        <input aria-label="Importe del ajuste" inputMode="decimal" placeholder="Importe" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} required />
        <input aria-label="Motivo del ajuste" maxLength={200} placeholder="Motivo" value={adjustmentNote} onChange={(event) => setAdjustmentNote(event.target.value)} required />
        <button type="submit" className="secondary">Agregar ajuste</button>
      </form>}
    </section>
    <Table rows={shownEntries} title="Movimientos incluidos" pageSize={50} searchText={(entry) => `${entry.label} ${entry.source} ${entry.currency}`}
      columns={[
        { label: "Fecha", render: (entry) => entry.date },
        { label: "Concepto", render: (entry) => entry.label },
        { label: "Tipo", render: (entry) => entry.kind === "income" ? "Cobro" : "Egreso" },
        { label: "Importe original", render: (entry) => currencyAmount(entry.amount_minor, entry.currency) },
      ]} />
    {editing && <div className="finance-close-actions">
      {latestClosed && <label>Motivo de la corrección<input maxLength={400} value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
      <button type="button" className="secondary" disabled={saving} onClick={() => void saveClose(false)}>Guardar borrador</button>
      <button type="button" className="primary" disabled={saving || montevideoToday() < monthEnd(month)} onClick={() => void saveClose(true)}>Finalizar mes</button>
      {montevideoToday() < monthEnd(month) && <small>Podés finalizar desde el último día de {monthLabel(month)}.</small>}
    </div>}
    {monthCloses.filter((row) => row.status === "closed").length > 0 && <section className="finance-close-panel">
      <h2>Versiones del cierre</h2>
      <div className="finance-close-versions">{monthCloses.filter((row) => row.status === "closed").sort((a, b) => b.revision - a.revision).map((row) =>
        <button type="button" className={selectedClosed?.revision === row.revision && reviewing ? "active" : ""} key={row.id} onClick={() => { setSelectedRevision(row.revision); setRevising(false); }}>
          Versión {row.revision}, {new Date(row.closed_at || row.created_at).toLocaleDateString("es-UY", { timeZone: "America/Montevideo" })}
        </button>)}</div>
    </section>}
  </section>;
}
