import type { CSSProperties } from "react";
import { formatArg, formatNumber, formatUyu, getLineValueArg, getLineValueUyu } from "../lib/format";
import type { DashboardData } from "../types";

export function OverviewView({ data }: { data: DashboardData }) {
  const pendingUnits = data.production
    .filter((item) => item.status === "Pendiente")
    .reduce((sum, item) => sum + item.quantity, 0);
  const inProgressUnits = data.production
    .filter((item) => item.status === "En producción")
    .reduce((sum, item) => sum + item.quantity, 0);
  const activeUnits = pendingUnits + inProgressUnits;
  const activeValueArg = data.production.reduce((sum, item) => sum + getLineValueArg(data.products, item), 0);
  const activeValueUyu = data.production.reduce((sum, item) => sum + getLineValueUyu(data.products, item, data.exchangeRate), 0);
  const activeCustomers = new Set(data.production.map((item) => item.customer)).size;

  const clientStats = Array.from(data.production.reduce((groups, item) => {
    groups.set(item.customer, (groups.get(item.customer) ?? 0) + item.quantity);
    return groups;
  }, new Map<string, number>()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const maxClientUnits = clientStats[0]?.[1] ?? 1;
  const maxStatusUnits = Math.max(pendingUnits, inProgressUnits, 1);
  const statusStats = [
    { label: "Pendientes", units: pendingUnits, tone: "pending" },
    { label: "En producción", units: inProgressUnits, tone: "progress" },
  ];

  return (
    <div className="page-stack summary-dashboard">
      <header className="summary-command-header">
        <section className="summary-command-copy">
          <h1>Resumen de operación</h1>
          <p>Estado actual de los pedidos, la producción y los clientes activos.</p>
        </section>

        <section className="summary-currency-kpis" aria-label="Valores comprometidos">
          <article className="summary-currency-kpi is-uyu">
            <h2>Valor uruguayo</h2>
            <strong>{formatUyu(activeValueUyu)}</strong>
          </article>
          <article className="summary-currency-kpi is-arg">
            <h2>Valor argentino</h2>
            <strong>{formatArg(activeValueArg)}</strong>
          </article>
        </section>
      </header>

      <section className="center-kpi-grid" aria-label="Indicadores principales">
        <article className="center-kpi kpi-orange">
          <strong>{formatNumber(activeUnits)}</strong>
          <p>Unidades activas</p>
        </article>
        <article className="center-kpi kpi-brown">
          <strong>{formatNumber(pendingUnits)}</strong>
          <p>Pendientes</p>
        </article>
        <article className="center-kpi kpi-green">
          <strong>{formatNumber(inProgressUnits)}</strong>
          <p>En producción</p>
        </article>
        <article className="center-kpi kpi-blue">
          <strong>{formatNumber(activeCustomers)}</strong>
          <p>Clientes activos</p>
        </article>
      </section>

      <section className="summary-analytics-grid" aria-label="Detalle operativo">
        <article className="panel workload-panel">
          <header className="summary-panel-heading">
            <section>
              <h2>Carga por estado</h2>
            </section>
            <dl>
              <dt>Total activo</dt>
              <dd>{formatNumber(activeUnits)} u.</dd>
            </dl>
          </header>

          <section className="workload-chart" aria-label="Unidades por estado de producción">
            {statusStats.map((status) => (
              <figure
                className={`workload-column is-${status.tone}`}
                key={status.label}
                style={{ "--bar-size": `${Math.max(12, (status.units / maxStatusUnits) * 100)}%` } as CSSProperties}
              >
                <strong>{formatNumber(status.units)}</strong>
                <b aria-hidden="true" />
                <figcaption>
                  <strong>{status.label}</strong>
                </figcaption>
              </figure>
            ))}
          </section>
        </article>

        <article className="panel clients-panel">
          <header className="summary-panel-heading">
            <section>
              <h2>Unidades por cliente</h2>
            </section>
          </header>

          <ol className="client-list">
            {clientStats.map(([customer, units], index) => (
              <li className="client-row" key={customer}>
                <b className="client-rank">{String(index + 1).padStart(2, "0")}</b>
                <strong className="client-name">{customer}</strong>
                <output className="client-units">{formatNumber(units)} u.</output>
                <progress max={maxClientUnits} value={units} aria-label={`${customer}: ${units} unidades`} />
              </li>
            ))}
          </ol>
        </article>
      </section>
    </div>
  );
}
