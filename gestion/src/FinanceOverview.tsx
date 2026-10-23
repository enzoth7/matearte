import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { money, type State } from "./data";
import { buildFinanceProjection, type FinanceMonth } from "./financeProjection";
import { buildRevenueForecast } from "./revenueForecast";
import { Card, ChartTooltip } from "./ui";

type ValueKey = "income" | "actualIncome" | "receivable" | "estimatedIncome"
  | "expense" | "actualExpense" | "payable" | "estimatedExpense"
  | "opening" | "result" | "cumulative";

const rows: { label: string; key: ValueKey; tone?: string }[] = [
  { label: "Saldo inicial", key: "opening", tone: "opening" },
  { label: "Ingresos", key: "income", tone: "income" },
  { label: "Cobros y señas", key: "actualIncome", tone: "income-detail" },
  { label: "Pedidos por cobrar", key: "receivable", tone: "income-detail" },
  { label: "Ventas futuras estimadas", key: "estimatedIncome", tone: "income-detail" },
  { label: "Egresos", key: "expense", tone: "expense" },
  { label: "Pagos registrados", key: "actualExpense", tone: "expense-detail" },
  { label: "Compromisos por pagar", key: "payable", tone: "expense-detail" },
  { label: "Costos futuros estimados", key: "estimatedExpense", tone: "expense-detail" },
  { label: "Resultado del mes", key: "result", tone: "result" },
  { label: "Saldo final", key: "cumulative", tone: "cumulative" },
];

function Matrix({ months, incomplete }: { months: FinanceMonth[]; incomplete: boolean }) {
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
          <div className="finance-cell finance-month-head">Concepto · UYU</div>
          {months.map((month) => (
            <div className="finance-cell finance-month-head" key={month.key}>{month.label}</div>
          ))}
          {rows.map((row) => (
            <Fragment key={row.key}>
              <div className={`finance-cell finance-row-label ${row.tone ?? ""}`}>{row.label}</div>
              {months.map((month) => (
                <div
                  className={`finance-cell finance-amount ${row.tone ?? ""}`}
                  key={`${row.key}-${month.key}`}
                  title={incomplete && ["expense", "actualExpense", "payable", "estimatedExpense", "opening", "result", "cumulative"].includes(row.key) ? "Sin fuente conectada" : money(month[row.key])}
                >
                  {incomplete && ["expense", "actualExpense", "payable", "estimatedExpense", "opening", "result", "cumulative"].includes(row.key) ? "—" : month[row.key] === 0 && row.key !== "opening" && row.key !== "cumulative" ? "—" : money(month[row.key])}
                </div>
              ))}
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

export function FinanceOverview({
  s,
}: {
  s: State;
}) {
  const [openingBalance, setOpeningBalance] = useState(0);
  const incomplete = s.source === "commerce" && !s.expensesConnected;
  const changeOpeningBalance = (value: string) => setOpeningBalance(Number(value) || 0);
  const months = buildFinanceProjection(s, { openingBalance, model: "linear" });
  const revenueForecast = buildRevenueForecast(s);
  const current = months[0];
  const last = months[11];

  return (
    <div className="finance-overview">
      <div className="finance-intro">
        <div>De {current.label} a {last.label} · UYU</div>
        <label className="finance-opening-control">
          Saldo final del mes anterior
          <input type="number" step="100" disabled={incomplete} placeholder="Sin datos" value={incomplete ? "" : openingBalance} onChange={(event) => changeOpeningBalance(event.target.value)} />
        </label>
      </div>
      <div className="finance-highlights">
        <div className="finance-highlight income">
          <div>Ingresos previstos · {current.label}</div>
          <strong>{money(current.income)}</strong>
        </div>
        <div className="finance-highlight expense">
          <div>Egresos previstos · {current.label}</div>
          <strong>{incomplete ? "—" : money(current.expense)}</strong>
        </div>
        <div className="finance-highlight result">
          <div>Resultado estimado · {current.label}</div>
          <strong className={current.result >= 0 ? "signal-green" : "signal-red"}>{incomplete ? "—" : money(current.result)}</strong>
        </div>
      </div>

      {!incomplete && s.expensesConnected && <div className="data-note">Los egresos salen de Compras y Gastos fijos y solo incluyen lo que esté cargado ahí.{s.expensesSkipped ? ` ${s.expensesSkipped} egreso${s.expensesSkipped === 1 ? "" : "s"} en moneda extranjera no se cuenta${s.expensesSkipped === 1 ? "" : "n"} porque falta la cotización en Monedas y cotizaciones.` : ""}</div>}
      {incomplete && <div className="data-note">Ingresos y cobros del comercio web. Todavía no hay egresos cargados: agregalos en Inventario y compras → Compras y Gastos fijos. Hasta entonces no se calcula ganancia con información incompleta.</div>}
      {s.payments.some((payment) => payment.reconciliationRequired) && <div className="data-note">Hay cobros pendientes de conciliación. Los totales UYU excluyen los importes sin equivalencia histórica; podés ver el importe original en Cobros.</div>}
      <section className="finance-flow" aria-label="Proyección mensual de ingresos y egresos">
        <Matrix months={months} incomplete={incomplete} />
      </section>
      <Card title="Proyección de ingresos · próximos 12 meses">
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
            <small className="finance-method">Los dos escenarios combinan una tendencia lineal o logarítmica con la variación mensual observada el último año ({revenueForecast.coverage} meses con ventas). La tabla usa el modelo lineal. El resultado mensual es ingreso menos egreso; el saldo final pasa al mes siguiente. Son estimaciones, no ingresos asegurados ni EBITDA.</small>
          </>
        ) : (
          <div className="finance-forecast-empty">Hay {revenueForecast.coverage} meses con ventas en el último año. Se necesitan al menos seis para calcular estas tendencias.</div>
        )}
      </Card>
    </div>
  );
}
