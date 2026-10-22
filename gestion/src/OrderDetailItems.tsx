export type OrderDetailRow = {
  id: string;
  name: string;
  sku?: string;
  color?: string;
  size?: string;
  weight?: string;
  quantity: number;
  amount?: string;
  extra?: string;
  notes?: string;
  /** Si existe, el nombre y el SKU abren el producto en el catálogo. */
  onOpen?: () => void;
};

const value = (text?: string) => text?.trim() || "—";

export function OrderDetailItems({ rows }: { rows: OrderDetailRow[] }) {
  return <section className="order-detail-items unified-order-items" aria-label="Artículos del pedido">
    <div className="order-detail-section-heading"><h3>Artículos</h3></div>
    <div className="order-detail-columns" aria-hidden="true">
      <span>Producto</span><span>SKU</span><span>Color</span><span>Tamaño</span><span>Peso</span><span>Cantidad</span><span>Importe</span>
    </div>
    <ul>{rows.map((row) => <li className="order-detail-item-row" key={row.id}>
      <div className="order-detail-item-copy">
        <div className="order-detail-item-header">{row.onOpen ? <button type="button" className="text-button order-detail-item-link" title="Ir al producto" onClick={row.onOpen}>{row.name}</button> : row.name}</div>
        {row.extra && <div className="order-detail-item-extra">{row.extra}</div>}
        {row.notes && <div className="order-detail-item-notes"><small>Notas para producción</small>{row.notes}</div>}
      </div>
      <div className="order-detail-item-meta"><small>SKU</small><span>{row.onOpen && row.sku?.trim() ? <button type="button" className="text-button order-detail-item-link" title="Ir al producto" onClick={row.onOpen}>{row.sku}</button> : value(row.sku)}</span></div>
      <div className="order-detail-item-meta"><small>Color</small><span>{value(row.color)}</span></div>
      <div className="order-detail-item-meta"><small>Tamaño</small><span>{value(row.size)}</span></div>
      <div className="order-detail-item-meta"><small>Peso</small><span>{value(row.weight)}</span></div>
      <div className="order-detail-item-meta order-detail-item-quantity"><small>Cantidad</small><span>{row.quantity}</span></div>
      <div className="order-detail-item-meta order-detail-item-total"><small>Importe</small><strong>{value(row.amount)}</strong></div>
    </li>)}</ul>
  </section>;
}
