export type EmailJob = {
  event_type: string;
  payload: Record<string, unknown>;
};

export type EmailOrder = {
  id: string;
  order_number: number;
  status: string;
  total_minor: number;
  currency: string;
  shipping_method: string;
  shipping_snapshot: Record<string, unknown>;
  customer_snapshot: Record<string, unknown>;
};

export type EmailOrderItem = {
  item_type: "catalog" | "design";
  title: string;
  quantity: number;
  total_minor: number;
  review_reason?: string | null;
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const money = (minor: number, currency = "UYU") => new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency,
  maximumFractionDigits: 0,
}).format(minor / 100);

const layout = (content: string) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f5efe3;color:#24150f;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5efe3;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fffdf8;border:1px solid #ddccb5">
        <tr><td style="background:#351d13;padding:24px 32px;color:#fff">
          <div style="font-family:Georgia,serif;font-size:28px;font-weight:bold">MateArte</div>
          <div style="margin-top:4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#e6d2b5">Arte &amp; tradición</div>
        </td></tr>
        <tr><td style="padding:34px 32px">${content}</td></tr>
        <tr><td style="border-top:1px solid #e7dac8;padding:22px 32px;color:#735947;font-size:12px;line-height:1.6">
          Este es un correo transaccional de MateArte relacionado con tu pedido.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const button = (label: string, url: string) => `<p style="margin:28px 0 6px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#351d13;color:#fff;text-decoration:none;padding:14px 22px;font-weight:bold">${escapeHtml(label)}</a></p>`;

const itemsBlock = (items: EmailOrderItem[]) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border-top:1px solid #e7dac8">
  ${items.map((item) => `<tr><td style="padding:12px 0;border-bottom:1px solid #e7dac8"><strong>${item.item_type === "design" ? "Mate personalizado" : "Producto"}</strong><br>${escapeHtml(item.title)} × ${item.quantity}</td><td align="right" style="padding:12px 0;border-bottom:1px solid #e7dac8">${escapeHtml(money(item.total_minor))}</td></tr>`).join("")}
</table>`;

const customerName = (order: EmailOrder) => escapeHtml(order.customer_snapshot?.fullName || "");
const intro = (title: string, order: EmailOrder, text: string) => `<p style="margin:0 0 8px;color:#8a5031;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Pedido #${order.order_number}</p><h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:34px;line-height:1.15">${escapeHtml(title)}</h1><p style="font-size:16px;line-height:1.7">Hola${customerName(order) ? ` ${customerName(order)}` : ""}, ${text}</p>`;

export function buildCommerceEmail(job: EmailJob, order: EmailOrder, items: EmailOrderItem[], siteUrl: string) {
  const orderUrl = `${siteUrl.replace(/\/$/, "")}/pedidos/${order.id}`;
  const adminUrl = "https://matearte-commerce-admin.vercel.app/orders";
  const summary = `${itemsBlock(items)}<p style="font-size:18px"><strong>Total: ${escapeHtml(money(order.total_minor, order.currency))}</strong></p>`;
  const rejectionReason = items.find((item) => item.review_reason)?.review_reason;
  const trackingCode = job.payload?.trackingCode;
  const trackingUrl = job.payload?.trackingUrl;

  switch (job.event_type) {
    case "customer_order_received":
      return { subject: `Recibimos tu pedido #${order.order_number}`, html: layout(`${intro("Recibimos tu pedido", order, "guardamos todos los detalles y estamos esperando la confirmación del pago.")}${summary}${button("Ver estado del pedido", orderUrl)}`) };
    case "customer_payment_confirmed":
      return { subject: `Pago confirmado · Pedido #${order.order_number}`, html: layout(`${intro("Pago confirmado", order, "Mercado Pago confirmó tu pago. Ya empezamos a preparar el próximo paso.")}${summary}${button("Seguir mi pedido", orderUrl)}`) };
    case "customer_custom_approved":
      return { subject: `Tu mate personalizado pasó a producción · #${order.order_number}`, html: layout(`${intro("Tu diseño fue aprobado", order, "revisamos el personalizado y ya está listo para entrar en producción.")}${itemsBlock(items)}${button("Ver mi pedido", orderUrl)}`) };
    case "customer_custom_rejected_refunded":
      return { subject: `Actualización y reembolso del pedido #${order.order_number}`, html: layout(`${intro("No pudimos producir este diseño", order, "la revisión técnica indicó que no podemos fabricarlo tal como fue solicitado. Iniciamos el reembolso completo.")}${rejectionReason ? `<p style="padding:16px;background:#f8eee5"><strong>Motivo:</strong> ${escapeHtml(rejectionReason)}</p>` : ""}${button("Ver detalle", orderUrl)}`) };
    case "customer_order_ready":
      return { subject: `Tu pedido #${order.order_number} está pronto`, html: layout(`${intro("Tu pedido está pronto", order, order.shipping_method === "pickup" ? "ya podés coordinar el retiro." : "terminamos de prepararlo y pronto saldrá hacia tu dirección.")}${button("Ver mi pedido", orderUrl)}`) };
    case "customer_order_shipped":
      return { subject: `Enviamos tu pedido #${order.order_number}`, html: layout(`${intro("Tu pedido está en camino", order, "el envío ya fue despachado.")}${trackingCode ? `<p><strong>Código de seguimiento:</strong> ${escapeHtml(trackingCode)}</p>` : ""}${trackingUrl ? button("Seguir envío", String(trackingUrl)) : button("Ver mi pedido", orderUrl)}`) };
    case "customer_international_received":
      return { subject: `Solicitud internacional recibida · #${order.order_number}`, html: layout(`${intro("Recibimos tu solicitud internacional", order, "guardamos los artículos y nos comunicaremos para coordinar disponibilidad, envío y forma de pago.")}${summary}${button("Ver solicitud", orderUrl)}`) };
    case "customer_payment_failed":
      return { subject: `No pudimos confirmar el pago · Pedido #${order.order_number}`, html: layout(`${intro("El pago no fue aprobado", order, "Mercado Pago no pudo confirmar la operación. Tu pedido todavía no está pagado.")}${button("Ver estado", orderUrl)}`) };
    case "customer_order_cancelled":
      return { subject: `Pedido #${order.order_number} cancelado`, html: layout(`${intro("El pedido fue cancelado", order, "registramos la cancelación. Si necesitás ayuda, respondé este correo.")}${button("Ver detalle", orderUrl)}`) };
    case "customer_order_refunded":
      return { subject: `Reembolso del pedido #${order.order_number}`, html: layout(`${intro("Pago reembolsado", order, "el reembolso fue registrado. La acreditación final depende de los plazos del medio de pago.")}${button("Ver detalle", orderUrl)}`) };
    case "admin_order_created":
      return { subject: `Nuevo pedido MateArte #${order.order_number}`, html: layout(`<h1 style="font-family:Georgia,serif">Nuevo pedido #${order.order_number}</h1>${summary}<p><strong>Cliente:</strong> ${customerName(order) || "Sin nombre"}</p>${button("Abrir pedidos", adminUrl)}`) };
    case "admin_payment_confirmed":
      return { subject: `Pago confirmado · Pedido #${order.order_number}`, html: layout(`<h1 style="font-family:Georgia,serif">Pago confirmado</h1><p>El pedido #${order.order_number} fue acreditado.</p>${summary}${button("Abrir pedido", adminUrl)}`) };
    case "admin_custom_review_required":
      return { subject: `Personalizado pendiente de revisión · #${order.order_number}`, html: layout(`<h1 style="font-family:Georgia,serif">Revisar personalizado</h1><p>El pedido #${order.order_number} está pagado y necesita aprobación antes de producirse.</p>${itemsBlock(items)}${button("Revisar pedido", adminUrl)}`) };
    case "admin_payment_review_required":
      return { subject: `Pedido #${order.order_number} requiere revisión manual`, html: layout(`<h1 style="font-family:Georgia,serif">Revisión manual</h1><p>El pago o el estado del pedido #${order.order_number} necesita verificación.</p>${button("Abrir pedidos", adminUrl)}`) };
    default:
      throw new Error(`Tipo de correo no soportado: ${job.event_type}`);
  }
}
