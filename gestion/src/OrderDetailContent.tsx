import type { ReactNode } from "react";
import { OrderDetailItems, type OrderDetailRow } from "./OrderDetailItems";

export type OrderDelivery = {
  method: string;
  paymentMethod: string;
  customer: string;
  phone?: ReactNode;
  email?: string;
  address?: string;
  locality?: string;
  country?: string;
  zone?: string;
  pickup: boolean;
};

export type OrderDetailView = {
  reference: string;
  date: string;
  channel: string;
  shipping: string;
  customer: string;
  products: string;
  payment?: string;
  paymentNote?: string;
  production: string;
  delivery: OrderDelivery;
  rows: OrderDetailRow[];
  totals?: ReactNode;
  receipt?: ReactNode;
  tracking?: { carrier: string; code: string };
};

/** The same detail structure is used for every sales channel. */
export function OrderDetailContent({ detail }: { detail: OrderDetailView }) {
  const delivery = detail.delivery;
  return <div className="order-detail-content">
    <section className="unified-order-identity" aria-label="Identificación del pedido">
      <div className="unified-order-reference"><small>Pedido</small><strong>{detail.reference}</strong></div>
      <div className="unified-order-identity-fact"><small>Fecha</small><strong>{detail.date}</strong></div>
      <div className="unified-order-identity-fact"><small>Canal</small><span className="badge">{detail.channel}</span></div>
      <div className="unified-order-identity-fact"><small>Envío</small><span className="badge">{detail.shipping}</span></div>
    </section>
    <section className="unified-order-overview" aria-label="Resumen del pedido">
      <h3>Resumen</h3>
      <div className="unified-order-facts">
        <div><small>Cliente</small><strong>{detail.customer}</strong></div>
        <div><small>Productos</small><strong>{detail.products}</strong></div>
        {detail.payment && <div><small>Pago</small><strong>{detail.payment}</strong>{detail.paymentNote && <span>{detail.paymentNote}</span>}</div>}
        <div><small>Producción</small><strong>{detail.production}</strong></div>
      </div>
    </section>
    <section className="unified-order-contact order-delivery-summary" aria-label="Entrega y contacto">
      <div className="order-delivery-summary__heading order-delivery-summary__heading--with-payment">
        <div><small>Entrega</small><strong>{delivery.method}</strong></div>
        <div><small>Medio de pago</small><strong>{delivery.paymentMethod || "No registrado"}</strong></div>
      </div>
      <div className="order-delivery-grid">
        <div><small>Cliente</small><strong>{delivery.customer || "Sin datos"}</strong>{delivery.phone}{delivery.email && <div className="unified-order-contact-line">{delivery.email}</div>}</div>
        <div><small>{delivery.pickup ? "Modalidad" : "Enviar a"}</small>
          <strong>{delivery.pickup ? "No requiere despacho" : delivery.address || "Dirección no disponible"}</strong>
          {delivery.locality && <div className="unified-order-contact-line">{delivery.locality}</div>}
          {delivery.country && !delivery.pickup && <div className="unified-order-contact-line">{delivery.country}</div>}
          {delivery.zone && <div className="unified-order-contact-line">{delivery.zone}</div>}
        </div>
      </div>
    </section>
    {detail.receipt}
    <OrderDetailItems rows={detail.rows} />
    {detail.totals && <section className="order-breakdown unified-order-breakdown" aria-label="Totales del pedido">{detail.totals}</section>}
    {detail.tracking && <section className="order-tracking-detail" aria-label="Seguimiento guardado"><small>Envío registrado</small><strong>{detail.tracking.carrier || "Sin transportista"}</strong><span>{detail.tracking.code || "Sin código"}</span></section>}
  </div>;
}
