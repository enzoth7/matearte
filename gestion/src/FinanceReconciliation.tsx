import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { accessUserId } from "./access";
import { commerceSource } from "./commerceSource";
import { money, type State } from "./data";
import { readExpenseSources, type ExpenseSources } from "./expenseSource";
import { readFinanceOpenings, type FinanceOpening } from "./financeOpeningSource";
import { readFinanceIncome, type FinanceManualIncome } from "./financeIncomeSource";
import { readFinanceMonthlyAdjustments, saveFinanceMonthlyAdjustment } from "./financeMonthlyAdjustmentSource";
import {
  buildFinanceCashEntries, calculateFinanceClose, firstFinanceCloseMonth, monthEnd, previousMonth,
  sameFinanceEntries, type FinanceAccount, type FinanceAdjustment, type FinanceBalance,
  type FinanceCloseRecord, type FinanceCurrency,
} from "./financeCloseModel";
import { montevideoToday } from "./overview";
import { Badge } from "./ui";
import "./financeReconciliation.css";

const today = montevideoToday();
const formatMinor = (minor: number | null) => minor === null ? "—" : money(minor / 100);
const currencyAmount = (minor: number, currency: FinanceCurrency) =>
  new Intl.NumberFormat("es-UY", { style: "currency", currency, currencyDisplay: "code" }).format(minor / 100);
const monthLabel = (month: string) => new Intl.DateTimeFormat("es-UY", { month: "long", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${month}-01T00:00:00Z`));
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
  const [financeOpenings, setFinanceOpenings] = useState<FinanceOpening[]>([]);
  const [manualIncomes, setManualIncomes] = useState<FinanceManualIncome[]>([]);
  const [monthlyAdjustments, setMonthlyAdjustments] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>({});
  const [adjustments, setAdjustments] = useState<FinanceAdjustment[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({ UYU: "1" });
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [reason, setReason] = useState("");
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [revising, setRevising] = useState(false);
  const [saving, setSaving] = useState(false);
  const rateSignature = JSON.stringify(s.records.monedas || []);

  const load = useCallback(async () => {
    if (!commerceSource) { setError("El comercio no está conectado."); setLoading(false); return; }
    try {
      const [accountResult, nextCloses, sources, openings, incomeResult, monthlyRows] = await Promise.all([
        commerceSource.from("finance_accounts").select("id,name,kind,currency").order("created_at"),
        readCloseRecords(),
        readExpenseSources(commerceSource),
        readFinanceOpenings(),
        readFinanceIncome(),
        readFinanceMonthlyAdjustments(),
      ]);
      if (accountResult.error) throw accountResult.error;
      if (!sources) throw new Error("No se pudieron leer los movimientos del mes.");
      setAccounts((accountResult.data || []) as FinanceAccount[]);
      setCloses(nextCloses);
      setExpenseSources(sources);
      setFinanceOpenings(openings);
      setManualIncomes(incomeResult.incomes);
      setMonthlyAdjustments(Object.fromEntries(monthlyRows.map((row) => [row.month, row.amountMinor])));
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
  const manuallyRecordedOpening = financeOpenings.find((row) => row.month === month);
  const openingBalances: FinanceBalance[] | null = month === firstFinanceCloseMonth
    ? manuallyRecordedOpening ? [{ id: `opening:${month}`, name: "Saldo de arranque", kind: "cash", currency: "UYU", amount_minor: manuallyRecordedOpening.amountMinor }] : []
    : previousClosed ? previousClosed.balances : null;
  const { entries, unknownAmounts } = useMemo(
    () => expenseSources ? buildFinanceCashEntries(month, s.payments, expenseSources, manualIncomes) : { entries: [], unknownAmounts: 0 },
    [month, s.payments, expenseSources, manualIncomes],
  );
  const monthlyAdjustmentMinor = monthlyAdjustments[month] || 0;
  useEffect(() => { setAdjustmentAmount(String(monthlyAdjustmentMinor / 100)); }, [month, monthlyAdjustmentMinor]);

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
  const liveSummary = calculateFinanceClose(providedBalances, openingBalances, adjustments, entries, numericRates, monthlyAdjustmentMinor);
  const shownRecord = reviewing ? selectedClosed : null;
  const shownBalances = shownRecord?.balances || providedBalances;
  const shownAdjustments = shownRecord?.adjustments || adjustments;
  const shownRates = shownRecord?.rates || numericRates;
  const shownEntries = shownRecord?.entries || entries;
  const summary = shownRecord?.summary || liveSummary;
  const balanceMissing = !reviewing && !balancesComplete;
  const stale = Boolean(shownRecord && (!sameFinanceEntries(shownRecord.entries, entries)
    || shownRecord.summary.adjustment_uyu_minor !== liveSummary.adjustment_uyu_minor));
  const usedCurrencies = [...new Set<FinanceCurrency>([
    ...accounts.map((row) => row.currency),
    ...shownEntries.map((row) => row.currency),
    ...shownAdjustments.map((row) => row.currency),
    ...(openingBalances || []).map((row) => row.currency),
  ])].filter((currency) => currency !== "UYU");

  const saveAdjustment = async (event: FormEvent) => {
    event.preventDefault();
    if (!owner || saving) return;
    const amount_minor = toMinor(adjustmentAmount);
    if (!adjustmentAmount.trim() || !Number.isSafeInteger(amount_minor)) {
      setError("Ingresá un importe válido para el ajuste."); return;
    }
    setSaving(true);
    try {
      await saveFinanceMonthlyAdjustment(month, amount_minor);
      setMonthlyAdjustments((current) => ({ ...current, [month]: amount_minor }));
      setError("");
      notify("Ajuste guardado en el resumen financiero.");
    } catch { setError("No se pudo guardar el ajuste."); }
    finally { setSaving(false); }
  };
  const saveClose = async (finalize: boolean) => {
    if (!owner || !commerceSource || !expenseSources) return;
    if (adjustmentAmount.trim() && toMinor(adjustmentAmount) !== monthlyAdjustmentMinor) {
      setError("Guardá el ajuste antes de guardar la conciliación."); return;
    }
    if (finalize && montevideoToday() < monthEnd(month)) { setError("El cierre se puede finalizar desde el último día del mes."); return; }
    if (finalize && (!balancesComplete || unknownAmounts || liveSummary.missing_currencies.length || openingBalances === null)) {
      setError("Completá los saldos, cotizaciones y movimientos antes de finalizar."); return;
    }
    if (finalize && latestClosed && !reason.trim()) { setError("Ingresá el motivo de la corrección."); return; }
    if (finalize) {
      const [freshSources, freshIncome, freshMonthlyRows] = await Promise.all([
        readExpenseSources(commerceSource),
        readFinanceIncome().catch(() => null),
        readFinanceMonthlyAdjustments().catch(() => null),
      ]);
      if (!freshSources || !freshIncome || !freshMonthlyRows) { setError("No se pudieron verificar los movimientos antes de cerrar."); return; }
      const freshEntries = buildFinanceCashEntries(month, s.payments, freshSources, freshIncome.incomes);
      const freshMonthlyMinor = freshMonthlyRows.find((row) => row.month === month)?.amountMinor || 0;
      if (freshEntries.unknownAmounts !== unknownAmounts || !sameFinanceEntries(freshEntries.entries, entries)
        || freshMonthlyMinor !== monthlyAdjustmentMinor) {
        setExpenseSources(freshSources);
        setManualIncomes(freshIncome.incomes);
        setMonthlyAdjustments(Object.fromEntries(freshMonthlyRows.map((row) => [row.month, row.amountMinor])));
        setError("Los movimientos cambiaron. Revisá los importes actualizados y volvé a finalizar.");
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
    <header className="finance-close-intro">
      <div><h2>Conciliá {monthLabel(month)}</h2><div>Compará los movimientos registrados con el dinero que hay en bancos, efectivo y billeteras.</div></div>
      <div className="finance-close-top">
        <label>Mes<input type="month" min={firstFinanceCloseMonth} value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} /></label>
        <button type="button" className="secondary" onClick={() => void refreshAll()}>Actualizar</button>
      </div>
    </header>
    {error && <div className="error" role="alert">{error}</div>}
    {month > firstFinanceCloseMonth && openingBalances === null && <div className="data-note">Para comparar saldos, primero hay que finalizar {monthLabel(previousMonth(month))}.</div>}
    {month > firstFinanceCloseMonth && manuallyRecordedOpening && previousClosed && summary.opening_uyu_minor !== manuallyRecordedOpening.amountMinor && <div className="data-note">El saldo cargado en Egresos difiere del cierre anterior. La conciliación usa el saldo del cierre.</div>}
    {unknownAmounts > 0 && <div className="error" role="alert">Hay {unknownAmounts} movimientos sin importe o moneda válida. Revisalos antes de cerrar.</div>}
    {stale && <div className="data-note">Los movimientos o el ajuste cambiaron desde este cierre. La versión guardada sigue intacta; Richard puede preparar una corrección.</div>}
    {reviewing && selectedClosed && <div className="finance-close-status">
      <Badge tone="green">Cerrado, versión {selectedClosed.revision}</Badge>
      <div>Finalizado el {new Date(selectedClosed.closed_at || selectedClosed.created_at).toLocaleString("es-UY", { timeZone: "America/Montevideo" })}</div>
      {selectedClosed.reason && <div>Motivo: {selectedClosed.reason}</div>}
      {owner && selectedClosed.revision === latestClosed?.revision && <button type="button" className="secondary" onClick={() => { setRevising(true); setSelectedRevision(null); }}>Preparar corrección</button>}
    </div>}
    <div className="finance-close-kpis">
      <div className="finance-close-kpi finance-close-kpi--income"><div>Resultado de caja</div><strong className={(summary.result_uyu_minor || 0) < 0 ? "negative" : ""}>{formatMinor(summary.result_uyu_minor)}</strong><small>Cobros menos egresos pagados</small></div>
      <div className="finance-close-kpi finance-close-kpi--expected"><div>Saldo esperado</div><strong>{formatMinor(summary.expected_uyu_minor)}</strong><small>Inicio, resultado y ajustes</small></div>
      <div className="finance-close-kpi finance-close-kpi--actual"><div>Saldo contado</div><strong>{balanceMissing ? "—" : formatMinor(summary.actual_uyu_minor)}</strong><small>Total de las cuentas cargadas</small></div>
      <div className={`finance-close-kpi finance-close-kpi--difference${!balanceMissing && summary.difference_uyu_minor === 0 ? " is-balanced" : ""}`}><div>Diferencia</div><strong>{balanceMissing ? "—" : formatMinor(summary.difference_uyu_minor)}</strong><small>Contado menos esperado</small></div>
    </div>
    <section className="finance-close-panel finance-close-panel--flow">
      <header><h2>1. Revisá los movimientos</h2><small>Así se forma el saldo que debería haber al final del mes.</small></header>
      <div className="finance-close-breakdown">
        <div><div>Saldo inicial</div><strong>{formatMinor(summary.opening_uyu_minor)}</strong></div>
        <div><div>Cobros registrados</div><strong>{formatMinor(summary.income_uyu_minor)}</strong></div>
        <div><div>Egresos pagados</div><strong>{formatMinor(summary.expense_uyu_minor)}</strong></div>
        <div><div>Ajuste</div><strong>{formatMinor(summary.adjustment_uyu_minor)}</strong></div>
        <div className="finance-close-breakdown-total"><div>Saldo esperado</div><strong>{formatMinor(summary.expected_uyu_minor)}</strong></div>
      </div>
    </section>
    <section className="finance-close-panel finance-close-panel--accounts">
      <header><h2>2. Contá el dinero</h2><small>Cargá el saldo de cada cuenta al cierre de {monthLabel(month)}. La comparación usa la suma de todas.</small></header>
      <div className="finance-close-account-table-wrap"><table className="finance-close-account-table">
        <colgroup><col className="finance-close-account-name" /><col className="finance-close-account-currency" /><col className="finance-close-account-money" /></colgroup>
        <thead><tr><th scope="col">Nombre</th><th scope="col">Moneda</th><th scope="col">Dinero</th></tr></thead>
        <tbody>{accounts.map((account) => {
          const savedBalance = shownBalances.find((balance) => balance.id === account.id);
          return <tr key={account.id}>
            <th scope="row">{account.name}</th>
            <td>{account.currency}</td>
            <td>{editing ? <input type="number" inputMode="decimal" step="0.01" min="0" aria-label={`Dinero en ${account.name}, ${account.currency}`} value={balanceInputs[account.id] ?? ""} onChange={(event) => setBalanceInputs((current) => ({ ...current, [account.id]: event.target.value }))} />
              : <strong>{savedBalance ? currencyAmount(savedBalance.amount_minor, account.currency) : "Sin saldo cargado"}</strong>}</td>
          </tr>;
        })}</tbody>
      </table></div>
      {!accounts.length && <div className="data-note">No hay cuentas configuradas para contar.</div>}
    </section>
    {usedCurrencies.length > 0 && <section className="finance-close-panel finance-close-panel--rates">
      <h2>Cotizaciones del cierre</h2>
      <div className="finance-close-rates">{usedCurrencies.map((currency) => <label key={currency}>UYU por {currency}
        {editing ? <input type="number" min="0.000001" step="any" value={rates[currency] || ""} onChange={(event) => setRates((current) => ({ ...current, [currency]: event.target.value }))} />
          : <strong>{Number(shownRates[currency] || 0).toLocaleString("es-UY", { maximumFractionDigits: 6 })}</strong>}
      </label>)}</div>
      {!reviewing && liveSummary.missing_currencies.length > 0 && <div className="error">Falta la cotización de: {liveSummary.missing_currencies.join(", ")}.</div>}
    </section>}
    <section className="finance-close-panel finance-close-panel--settings">
      <h2>Ajuste</h2>
      {editing ? <form className="finance-close-adjustment-form" onSubmit={(event) => void saveAdjustment(event)}>
        <input aria-label="Importe del ajuste en UYU" placeholder="Importe, + o -" type="number" inputMode="decimal" step="0.01" value={adjustmentAmount}
          onChange={(event) => setAdjustmentAmount(event.target.value)} required />
        <button type="submit" className="secondary" disabled={saving}>Guardar ajuste</button>
      </form> : <strong>{formatMinor(summary.adjustment_uyu_minor)}</strong>}
    </section>
    <section className="finance-close-panel finance-close-panel--decision">
      <h2>3. Compará y cerrá</h2>
      <div className={`finance-close-decision-state${balanceMissing || summary.difference_uyu_minor === null ? " is-pending" : summary.difference_uyu_minor === 0 ? " is-balanced" : " is-different"}`}>
        <strong>{balanceMissing ? "Faltan saldos por cargar" : summary.difference_uyu_minor === null ? "Falta información para comparar" : summary.difference_uyu_minor === 0 ? "Las cuentas coinciden" : `Diferencia: ${formatMinor(summary.difference_uyu_minor)}`}</strong>
        <div>{balanceMissing ? "Completá cada cuenta antes de revisar la diferencia." : summary.difference_uyu_minor === 0 ? "El dinero contado coincide con el saldo esperado." : "Revisá movimientos, cotizaciones y saldos por cuenta."}</div>
      </div>
      {editing && <div className="finance-close-actions">
        {latestClosed && <label>Motivo de la corrección<input maxLength={400} value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
        <button type="button" className="secondary" disabled={saving} onClick={() => void saveClose(false)}>Guardar borrador</button>
        <button type="button" className="primary" disabled={saving || montevideoToday() < monthEnd(month)} onClick={() => void saveClose(true)}>Finalizar mes</button>
        {montevideoToday() < monthEnd(month) && <small>Podés finalizar desde el último día de {monthLabel(month)}.</small>}
      </div>}
    </section>
    {monthCloses.filter((row) => row.status === "closed").length > 0 && <section className="finance-close-panel">
      <h2>Versiones del cierre</h2>
      <div className="finance-close-versions">{monthCloses.filter((row) => row.status === "closed").sort((a, b) => b.revision - a.revision).map((row) =>
        <button type="button" className={selectedClosed?.revision === row.revision && reviewing ? "active" : ""} key={row.id} onClick={() => { setSelectedRevision(row.revision); setRevising(false); }}>
          Versión {row.revision}, {new Date(row.closed_at || row.created_at).toLocaleDateString("es-UY", { timeZone: "America/Montevideo" })}
        </button>)}</div>
    </section>}
  </section>;
}
