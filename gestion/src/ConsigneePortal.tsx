import { useState } from "react";
import { formatDate } from "./dateFormat";
import type { ConsigneeDashboard, ConsigneePortalConsignment, ConsigneePortalEvent } from "./consigneePortalSource";

const eventLabel: Record<ConsigneePortalEvent["kind"], string> = {
  dispatch: "Envío", return: "Devolución", kept: "Vendidas o conservadas",
  receipt: "Pago recibido", allocation: "Pago aplicado",
};
const amount = (value: number, currency: "UYU" | "ARS") => new Intl.NumberFormat("es-UY", {
  style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 2,
}).format(value / 100);

function ConsignmentCard({ item }: { item: ConsigneePortalConsignment }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  return <article className="consignee-card">
    <header className="consignee-card-header">
      <div><h2>{item.reference}</h2><small>Desde {formatDate(item.createdAt)}, moneda pactada {item.currency}</small></div>
      <strong>{amount(item.totals.balanceMinor, item.currency)} por pagar</strong>
    </header>
    <dl className="consignee-stats">
      <div><dt>Enviadas</dt><dd>{item.totals.dispatched}</dd></div>
      <div><dt>En su poder</dt><dd>{item.totals.held}</dd></div>
      <div><dt>Vendidas o conservadas</dt><dd>{item.totals.kept}</dd></div>
      <div><dt>Devueltas</dt><dd>{item.totals.returned}</dd></div>
      <div><dt>Mercadería en su poder</dt><dd>{amount(item.totals.heldValueMinor, item.currency)}</dd></div>
      <div><dt>Importe confirmado</dt><dd>{amount(item.totals.confirmedMinor, item.currency)}</dd></div>
      <div><dt>Pagos aplicados</dt><dd>{amount(item.totals.paidMinor, item.currency)}</dd></div>
      <div><dt>Adelanto a favor</dt><dd>{amount(item.totals.creditMinor, item.currency)}</dd></div>
    </dl>
    <div className="consignee-table-wrap"><table><caption>Productos de {item.reference}</caption><thead><tr>
      <th scope="col">Producto</th><th scope="col">Precio pactado</th><th scope="col">Enviadas</th>
      <th scope="col">En su poder</th><th scope="col">Vendidas o conservadas</th><th scope="col">Devueltas</th>
    </tr></thead><tbody>{item.lines.map((line) => <tr key={line.id}>
      <th scope="row">{line.title}<small>SKU {line.sku}</small></th>
      <td>{amount(line.unitPriceMinor, item.currency)}</td><td>{line.dispatched}</td>
      <td>{line.held}</td><td>{line.kept}</td><td>{line.returned}</td>
    </tr>)}</tbody></table></div>
    <button type="button" className="consignee-history-toggle" aria-expanded={historyOpen}
      onClick={() => setHistoryOpen((open) => !open)}>{historyOpen ? "Ocultar historial" : "Ver historial"}</button>
    {historyOpen && <ol className="consignee-history">{item.events.map((event) => <li key={event.id}>
      <time dateTime={event.date}>{formatDate(event.date)}</time>
      <div><strong>{eventLabel[event.kind]}</strong><small>{event.detail}</small></div>
      <div>{event.quantity > 0 ? `${event.quantity} unidades` : amount(event.amountMinor, item.currency)}</div>
    </li>)}</ol>}
  </article>;
}

export function ConsigneePortal({ dashboard, loading, error, refresh, signOut }: {
  dashboard: ConsigneeDashboard; loading: boolean; error: string;
  refresh: () => Promise<void>; signOut: () => Promise<void>;
}) {
  return <div className="consignee-portal">
    <a className="skip" href="#consignee-main">Saltar al contenido</a>
    <header className="consignee-topbar"><div className="consignee-brand"><img src="/matearte-icon.png" alt="" width="40" height="40" /><strong>MateArte</strong></div>
      <button type="button" onClick={() => void signOut()}>Cerrar sesión</button></header>
    <main id="consignee-main">
      <div className="consignee-heading"><div><h1>Consignaciones</h1><div>{dashboard.name}</div></div>
        <button type="button" disabled={loading} onClick={() => void refresh()}>{loading ? "Actualizando…" : "Actualizar"}</button></div>
      {error && <div role="alert" className="error">{error}</div>}
      {!dashboard.consignments.length && <div className="consignee-empty">Aún no hay consignaciones para mostrar.</div>}
      {dashboard.consignments.map((item) => <ConsignmentCard key={item.id} item={item} />)}
    </main>
  </div>;
}
