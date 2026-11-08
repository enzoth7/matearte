import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { money, type State } from "./data";
import { buildFinanceProjection, type FinanceMonth } from "./financeProjection";
import { buildRevenueForecast } from "./revenueForecast";
import { montevideoToday } from "./overview";
import { readFinanceOpenings, type FinanceOpening } from "./financeOpeningSource";
import { commerceSource } from "./commerceSource";
import { accessUserId } from "./access";
import { readFinanceMonthlyAdjustments, saveFinanceMonthlyAdjustment } from "./financeMonthlyAdjustmentSource";
import { readFinanceIncome, type FinanceManualIncome } from "./financeIncomeSource";
import { Card, ChartTooltip, Modal } from "./ui";

type MatrixRow = { label: string; tone: string; category?: "income" | "expense"; value: (month: FinanceMonth) => number };
const preferredIncome = ["Ventas web", "Ventas locales", "Ventas mayoristas", "Entregas a cuenta", "Consignaciones", "Ingresos extraordinarios", "Devolución impuestos", "Otros", "Ventas futuras estimadas"];
const monthShift = (month: string, offset: number) => {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + offset, 1)).toISOString().slice(0, 7);
};
function matrixRows(months: FinanceMonth[], configuredExpenses: string[], configuredIncomes: string[]): MatrixRow[] {
  const incomeNames = [...new Set([...configuredIncomes, ...months.flatMap((month) => Object.keys(month.incomeCategories))])].sort((a, b) =>
    (preferredIncome.indexOf(a) < 0 ? 99 : preferredIncome.indexOf(a)) - (preferredIncome.indexOf(b) < 0 ? 99 : preferredIncome.indexOf(b)) || a.localeCompare(b, "es"));
  const expenseNames = [...new Set([...configuredExpenses, ...months.flatMap((month) => Object.keys(month.expenseCategories))])].sort((a, b) =>
    Number(a === "Costos futuros estimados") - Number(b === "Costos futuros estimados") || a.localeCompare(b, "es"));
  return [
    { label: "Saldo inicial", tone: "opening", value: (month) => month.opening },
    { label: "Ingresos", tone: "income", value: (month) => month.income },
    ...incomeNames.map((label) => ({ label, tone: "income-detail", category: "income" as const,
      value: (month: FinanceMonth) => month.incomeCategories[label] || 0 })),
    { label: "Egresos", tone: "expense", value: (month) => month.expense },
    ...expenseNames.map((label) => ({ label, tone: "expense-detail", category: "expense" as const,
      value: (month: FinanceMonth) => month.expenseCategories[label] || 0 })),
    { label: "Resultado del mes", tone: "result", value: (month) => month.result },
    { label: "Retiros", tone: "withdrawals", value: (month) => month.withdrawals },
    ...(months.some((month) => month.contributions) ? [{ label: "Aportes", tone: "contributions", value: (month: FinanceMonth) => month.contributions }] : []),
    { label: "Ajuste", tone: "manual-adjustment", value: (month) => month.manualAdjustment },
    { label: "Saldo final", tone: "cumulative", value: (month) => month.cumulative },
  ] satisfies MatrixRow[];
}

function Matrix({ months, incomplete, configuredExpenses, configuredIncomes, onEditAdjustment, onOpenRow }: {
  months: FinanceMonth[]; incomplete: boolean; configuredExpenses: string[]; configuredIncomes: string[];
  onEditAdjustment?: (month: FinanceMonth) => void;
  onOpenRow: (kind: "income" | "expense", month: string, category?: string) => void;
}) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: 0, max: 0, thumbWidth: 0 });

  const updateScroll = () => {
    const element = windowRef.current;
    if (!element) return;
    const max = Math.max(0, element.scrollWidth - element.clientWidth);
    const trackWidth = Math.max(0, element.clientWidth - 24);
    setScroll({
      left: Math.min(element.scrollLeft, max),
      max,
      thumbWidth: Math.max(48, trackWidth * element.clientWidth / element.scrollWidth),
    });
  };

  useLayoutEffect(() => {
    const element = windowRef.current;
    if (!element) return;
    const observer = new ResizeObserver(updateScroll);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    updateScroll();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (windowRef.current) windowRef.current.scrollLeft = 0;
    updateScroll();
  }, [months[0]?.key]);

  const rows = matrixRows(months, configuredExpenses, configuredIncomes);

  return (
    <div className="finance-matrix-layout">
      <div
        className="finance-matrix-window"
        ref={windowRef}
        role="region"
        tabIndex={0}
        onScroll={updateScroll}
        aria-label={`Meses de ${months[0].label} a ${months[months.length - 1].label}`}
      >
        <div className="finance-matrix">
          <div className="finance-cell finance-month-head">Concepto, UYU</div>
          {months.map((month) => (
            <div className="finance-cell finance-month-head" key={month.key}>{month.label}</div>
          ))}
          {rows.map((row) => (
            <Fragment key={`${row.tone}:${row.label}`}>
              <div className={`finance-cell finance-row-label ${row.tone}${row.category ? " finance-category-label" : ""}`}>
                {row.category || row.tone === "income" || row.tone === "expense"
                  ? <button type="button" className="finance-row-link"
                    onClick={() => onOpenRow(row.category || row.tone as "income" | "expense", months[0].key, row.category ? row.label : undefined)}
                  >{row.label}</button> : row.label}
              </div>
              {months.map((month) => {
                const amount = row.value(month);
                const signedAmountVisible = ["opening", "result", "cumulative"].includes(row.tone)
                  && !(incomplete && ["result", "cumulative"].includes(row.tone))
                  && !(["opening", "cumulative"].includes(row.tone) && !month.balanceKnown);
                return <div
                  className={`finance-cell finance-amount ${row.tone}${signedAmountVisible && amount > 0 ? " finance-positive" : ""}${signedAmountVisible && amount < 0 ? " finance-negative" : ""}`}
                  key={`${row.label}-${month.key}`}
                  title={incomplete && ["expense", "expense-detail", "result", "cumulative"].includes(row.tone) ? "Sin fuente conectada"
                    : ["opening", "cumulative"].includes(row.tone) && !month.balanceKnown ? "Saldo de arranque sin cargar" : money(amount)}
                >
                  {row.tone === "manual-adjustment" && onEditAdjustment && month.key <= montevideoToday().slice(0, 7)
                    ? <button type="button" className="finance-adjustment-edit" aria-label={`Editar ajuste de ${month.label}`}
                      onClick={() => onEditAdjustment(month)}>{money(amount)}</button>
                    : incomplete && ["expense", "expense-detail", "result", "cumulative"].includes(row.tone)
                      || ["opening", "cumulative"].includes(row.tone) && !month.balanceKnown ? "—"
                      : amount === 0 && (row.category || row.tone === "withdrawals" || row.tone === "manual-adjustment") ? "—" : money(amount)}
                </div>
              })}
            </Fragment>
          ))}
        </div>
      </div>
      {scroll.max > 0 && (
        <div className="finance-scrollbar">
          <input
            type="range"
            min="0"
            max={scroll.max}
            step="1"
            value={scroll.left}
            aria-label="Desplazar tabla de meses horizontalmente"
            style={{ "--finance-thumb-width": `${scroll.thumbWidth}px` } as CSSProperties}
            onChange={(event) => {
              if (windowRef.current) windowRef.current.scrollLeft = Number(event.target.value);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function FinanceOverview({ s, notify, go }: { s: State; notify: (message: string) => void; go: (path: string) => void }) {
  const currentMonth = montevideoToday().slice(0, 7);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [openings, setOpenings] = useState<FinanceOpening[]>([]);
  const [openingError, setOpeningError] = useState("");
  const [configuredExpenses, setConfiguredExpenses] = useState<string[]>([]);
  const [configuredIncomes, setConfiguredIncomes] = useState<string[]>(["Ingresos extraordinarios", "Otros", "Devolución impuestos"]);
  const [manualIncomes, setManualIncomes] = useState<FinanceManualIncome[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, { withdrawals: number; contributions: number }>>({});
  const [monthlyAdjustments, setMonthlyAdjustments] = useState<Record<string, number>>({});
  const [editingAdjustment, setEditingAdjustment] = useState<FinanceMonth | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  useEffect(() => {
    let active = true;
    void readFinanceOpenings().then((rows) => { if (active) setOpenings(rows); })
      .catch(() => { if (active) setOpeningError("No se pudieron cargar los saldos de arranque."); })
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    void readFinanceMonthlyAdjustments().then((rows) => {
      if (active) setMonthlyAdjustments(Object.fromEntries(rows.map((row) => [row.month, row.amountMinor / 100])));
    }).catch(() => { if (active) notify("No se pudieron cargar los ajustes mensuales."); });
    return () => { active = false; };
  }, [notify]);
  useEffect(() => {
    let active = true;
    void readFinanceIncome().then((result) => {
      if (!active) return;
      setConfiguredIncomes(result.categories);
      setManualIncomes(result.incomes);
    }).catch(() => { if (active) notify("No se pudieron cargar los ingresos adicionales."); });
    return () => { active = false; };
  }, [notify]);
  useEffect(() => {
    if (!commerceSource) return;
    let active = true;
    void Promise.all([
      commerceSource.from("expense_categories").select("name,active").eq("active", true),
      commerceSource.rpc("finance_summary_adjustments"),
    ]).then(([categoryResult, adjustmentResult]) => {
      if (categoryResult.error || adjustmentResult.error || !active) return;
      setConfiguredExpenses((categoryResult.data || []).map((row) => String(row.name)));
      const totals: Record<string, { withdrawals: number; contributions: number }> = {};
      for (const row of (adjustmentResult.data || []) as { month: string; withdrawals_minor: number; contributions_minor: number }[]) {
        totals[row.month.slice(0, 7)] = { withdrawals: Number(row.withdrawals_minor) / 100, contributions: Number(row.contributions_minor) / 100 };
      }
      setAdjustments(totals);
    });
    return () => { active = false; };
  }, []);
  const incomplete = s.source === "commerce" && !s.expensesConnected;
  const firstRecordedMonth = [
    ...s.payments.map((payment) => payment.date.slice(0, 7)),
    ...s.expenses.map((expense) => expense.date.slice(0, 7)),
    ...s.orders.map((order) => order.date.slice(0, 7)),
    currentMonth,
  ].filter((value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)).sort()[0] || currentMonth;
  const openingBalances = Object.fromEntries(openings.map((row) => [row.month, row.amountMinor / 100]));
  const months = buildFinanceProjection(s, { startMonth, openingBalances, monthlyAdjustments, adjustments, manualIncomes, model: "linear" });
  const revenueForecast = buildRevenueForecast(s);
  const current = months[0];
  const saveAdjustment = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingAdjustment) return;
    const amountMinor = Math.round(Number(adjustmentAmount.replace(",", ".")) * 100);
    if (!adjustmentAmount.trim() || !Number.isSafeInteger(amountMinor)) {
      notify("Ingresá un importe válido para el ajuste."); return;
    }
    setSavingAdjustment(true);
    try {
      await saveFinanceMonthlyAdjustment(editingAdjustment.key, amountMinor);
      setMonthlyAdjustments((previous) => ({ ...previous, [editingAdjustment.key]: amountMinor / 100 }));
      setEditingAdjustment(null);
      notify("Ajuste mensual guardado.");
    } catch { notify("No se pudo guardar el ajuste mensual."); }
    finally { setSavingAdjustment(false); }
  };

  return (
    <div className="finance-overview">
      <div className="finance-highlights">
        <div className="finance-highlight income">
          <div>Ingresos de {current.label}</div>
          <strong>{money(current.income)}</strong>
        </div>
        <div className="finance-highlight expense">
          <div>Egresos de {current.label}</div>
          <strong>{incomplete ? "—" : money(current.expense)}</strong>
        </div>
        <div className="finance-highlight result">
          <div>Resultado de {current.label}</div>
          <strong className={current.result >= 0 ? "signal-green" : "signal-red"}>{incomplete ? "—" : money(current.result)}</strong>
        </div>
      </div>
      <nav className="finance-period-controls" aria-label="Selector de meses">
        <button type="button" className="secondary" aria-label="Ver mes anterior" disabled={startMonth <= firstRecordedMonth} onClick={() => setStartMonth(monthShift(startMonth, -1))}>←</button>
        <input type="month" aria-label="Mes del resumen" min={firstRecordedMonth} max={currentMonth} value={startMonth} onChange={(event) => event.target.value && setStartMonth(event.target.value)} />
        <button type="button" className="secondary" aria-label="Ver mes siguiente" disabled={startMonth >= currentMonth} onClick={() => setStartMonth(monthShift(startMonth, 1))}>→</button>
      </nav>
      {openingError && <div className="error" role="alert">{openingError}</div>}
      {incomplete && <div className="data-note">Todavía no hay egresos registrados para completar la proyección. Agregalos en Finanzas, Egresos y Gastos fijos.</div>}
      {s.payments.some((payment) => payment.reconciliationRequired) && <div className="data-note">Hay cobros pendientes de conciliación. Los totales UYU excluyen los importes sin equivalencia histórica.</div>}
      <section className="finance-flow" aria-label="Proyección mensual de ingresos y egresos">
        <Matrix months={months} incomplete={incomplete} configuredExpenses={configuredExpenses} configuredIncomes={configuredIncomes}
          onOpenRow={(kind, month, category) => go(`/finanzas/${kind === "income" ? "ingresos" : "egresos"}?mes=${month}&detalle=1${category ? `&categoria=${encodeURIComponent(category)}` : ""}`)}
          onEditAdjustment={accessUserId(s) === "t1" ? (month) => { setEditingAdjustment(month); setAdjustmentAmount(String(month.manualAdjustment)); } : undefined} />
      </section>
      {editingAdjustment && <Modal title={`Ajuste de ${editingAdjustment.label}`} onClose={() => setEditingAdjustment(null)}>
        <form className="finance-adjustment-form" onSubmit={(event) => void saveAdjustment(event)}>
          <label>Importe en UYU, positivo o negativo<input type="number" inputMode="decimal" step="0.01" value={adjustmentAmount}
            onChange={(event) => setAdjustmentAmount(event.target.value)} required autoFocus /></label>
          <div className="data-note">El ajuste modifica el saldo final de este mes y el saldo inicial del siguiente.</div>
          <div className="form-actions"><button type="button" className="secondary" onClick={() => setEditingAdjustment(null)}>Cancelar</button>
            <button type="submit" className="primary" disabled={savingAdjustment}>Guardar ajuste</button></div>
        </form>
      </Modal>}
      <Card title="Proyección de ingresos, próximos 12 meses">
        {revenueForecast.months.length > 0 ? (
          <>
            <div className="finance-line-legend" aria-hidden="true">
              <div className="linear">Lineal</div>
              <div className="logarithmic">Logarítmica</div>
            </div>
            <div className="finance-revenue-chart" role="img" aria-label="Proyección de ingresos de doce meses con tendencias lineal y logarítmica">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueForecast.months} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#171412" strokeOpacity={0.1} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} interval={1} />
                  <YAxis axisLine={false} tickLine={false} width={64} tick={{ fontSize: 10 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="linear" dataKey="linear" name="Lineal" stroke="#2f7d55" strokeWidth={3} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                  <Line type="linear" dataKey="logarithmic" name="Logarítmica" stroke="#2f7d55" strokeOpacity={0.6} strokeDasharray="7 5" strokeWidth={3} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <small className="finance-method">Los dos escenarios combinan una tendencia lineal o logarítmica con la variación mensual observada el último año ({revenueForecast.coverage} meses con ventas). La tabla usa el modelo lineal. Los pedidos mayoristas históricos ya cobrados figuran en el mes del pedido. Las cifras futuras son estimaciones, no ingresos asegurados.</small>
          </>
        ) : (
          <div className="finance-forecast-empty">Hay {revenueForecast.coverage} meses con ventas en el último año. Se necesitan al menos seis para calcular estas tendencias.</div>
        )}
      </Card>
    </div>
  );
}
