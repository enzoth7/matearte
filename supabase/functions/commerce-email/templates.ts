export const COMMERCE_EMAIL_EVENT_TYPES = [
  "customer_order_received",
  "customer_custom_approved",
  "customer_order_ready",
  "customer_order_shipped",
  "admin_payment_confirmed",
] as const;

export type CommerceEmailEventType = typeof COMMERCE_EMAIL_EVENT_TYPES[number];

export type EmailJob = {
  event_type: CommerceEmailEventType;
  payload: Record<string, unknown>;
};

export type EmailOrder = {
  id: string;
  order_number: number;
  status: string;
  total_minor: number;
  items_subtotal_minor: number;
  shipping_minor: number;
  payment_fee_minor: number;
  discount_code: string | null;
  discount_minor: number;
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
}).format(minor / 100).replaceAll("\u00a0", " ");

const normalizedSiteUrl = (siteUrl: string) => siteUrl.replace(/\/$/, "");

const safeHttpUrl = (value: unknown) => {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
};

const brandHeader = (siteUrl: string) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0">
  <tr>
    <td align="center" valign="middle" height="116" style="height:116px;border-bottom:1px solid #bfab8c">
      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0">
        <tr>
          <td width="56" height="56" style="width:56px;height:56px">
            <img src="${escapeHtml(normalizedSiteUrl(siteUrl))}/assets/matearte/home-v2/logo.png" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border:0;object-fit:cover">
          </td>
          <td valign="middle" style="padding-left:16px;text-align:left">
            <div style="color:#311c12;font-family:'Newsreader',Georgia,serif;font-size:30px;font-weight:500;line-height:34px;white-space:nowrap">MateArte</div>
            <div style="color:#79452d;font-family:'Outfit',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:2.34px;line-height:16px;text-transform:uppercase;white-space:nowrap">ARTE &amp; TRADICIÓN</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

const layout = (content: string, siteUrl: string) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:wght@500&amp;family=Outfit:wght@400;600&amp;display=swap" rel="stylesheet">
  <style>@media only screen and (max-width:680px){.email-wrap{padding:12px!important}.email-body{padding:24px!important}.brand-name{font-size:27px!important}.brand-tagline{font-size:11px!important;letter-spacing:1.8px!important}}</style>
</head>
<body style="margin:0;background:#f4f4f4;color:#311c12;font-family:'Outfit',Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-wrap" style="width:100%;background:#f4f4f4;padding:28px 12px;border-collapse:separate;border-spacing:0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#fffdf8;border:1px solid #bfab8c;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden">
        <tr><td>${brandHeader(siteUrl)}</td></tr>
        <tr><td class="email-body" style="padding:32px">${content}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const heading = (title: string) => `<h1 style="margin:0 0 16px;color:#311c12;font-family:'Newsreader',Georgia,serif;font-size:32px;font-weight:500;line-height:1.18">${escapeHtml(title)}</h1>`;

const copy = (text: string) => `<div style="margin:0 0 16px;color:#79452d;font-family:'Outfit',Arial,sans-serif;font-size:16px;font-weight:400;line-height:1.35">${text}</div>`;

const summaryRow = (label: string, value: string, options: { strong?: boolean; height?: number } = {}) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;height:${options.height ?? 30}px;margin:0 0 16px;border-collapse:separate;border-spacing:0">
  <tr>
    <td valign="middle" style="color:#79452d;font-family:'Outfit',Arial,sans-serif;font-size:15px;font-weight:400;line-height:20px">${escapeHtml(label)}</td>
    <td align="right" valign="middle" style="color:#311c12;font-family:'Outfit',Arial,sans-serif;font-size:16px;font-weight:${options.strong === false ? 400 : 600};line-height:20px;white-space:nowrap">${escapeHtml(value)}</td>
  </tr>
</table>`;

const lineItem = (item: EmailOrderItem, currency: string) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;height:40px;margin:0 0 16px;border-bottom:1px solid #bfab8c;border-collapse:separate;border-spacing:0">
  <tr>
    <td valign="middle" style="padding:0 16px;color:#311c12;font-family:'Outfit',Arial,sans-serif;font-size:15px;font-weight:600;line-height:20px">${escapeHtml(item.title)}${item.quantity > 1 ? ` × ${item.quantity}` : ""}</td>
    <td align="right" valign="middle" style="padding:0 16px;color:#311c12;font-family:'Outfit',Arial,sans-serif;font-size:15px;font-weight:600;line-height:20px;white-space:nowrap">${escapeHtml(money(item.total_minor, currency))}</td>
  </tr>
</table>`;

const itemsBlock = (items: EmailOrderItem[], currency: string) => items.map((item) => lineItem(item, currency)).join("");

const button = (label: string, url: string) => `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0;border-collapse:separate;border-spacing:0"><tr><td style="background:#79452d;border-radius:4px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;color:#fffdf8;font-family:'Outfit',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:1.04px;line-height:16px;text-decoration:none;text-transform:uppercase;white-space:nowrap">${escapeHtml(label.toUpperCase())}</a></td></tr></table>`;

const customerName = (order: EmailOrder) => String(order.customer_snapshot?.fullName || "").trim();

export function buildCommerceEmail(
  job: EmailJob,
  order: EmailOrder,
  items: EmailOrderItem[],
  siteUrl: string,
  orderAccessToken?: string | null,
  commerceAdminUrl = "https://matearte-commerce-admin.vercel.app/orders",
) {
  const orderUrl = `${normalizedSiteUrl(siteUrl)}/pedidos/${order.id}${orderAccessToken ? `#access=${encodeURIComponent(orderAccessToken)}` : ""}`;
  const adminUrl = safeHttpUrl(commerceAdminUrl) || "https://matearte-commerce-admin.vercel.app/orders";
  const name = customerName(order);
  const greetingName = escapeHtml(name || "cliente");
  const trackingCode = String(job.payload?.trackingCode || "—").trim();
  const trackingUrl = safeHttpUrl(job.payload?.trackingUrl) || safeHttpUrl(trackingCode);
  const shippingCarrier = String(job.payload?.shippingCarrier || "—").trim();
  const orderRow = summaryRow("Pedido", `#${order.order_number}`, { strong: false });
  const products = itemsBlock(items, order.currency);
  const totalRow = summaryRow("Total", money(order.total_minor, order.currency));

  switch (job.event_type) {
    case "customer_order_received":
      return {
        subject: `Recibimos tu pedido #${order.order_number}`,
        html: layout(
          `${heading("Recibimos tu pedido")}${copy(`Hola ${greetingName}, gracias por elegir MateArte. Ya recibimos tu pedido y te avisaremos cuando confirmemos el pago.`)}${orderRow}${products}${summaryRow("Subtotal", money(order.items_subtotal_minor, order.currency), { height: 24 })}${order.discount_minor > 0 ? summaryRow(`Descuento${order.discount_code ? ` · ${order.discount_code}` : ""}`, `−${money(order.discount_minor, order.currency)}`) : ""}${summaryRow("Envío", money(order.shipping_minor, order.currency))}${order.payment_fee_minor > 0 ? summaryRow("Cargos", money(order.payment_fee_minor, order.currency)) : ""}${totalRow}${button("Ver estado del pedido", orderUrl)}`,
          siteUrl,
        ),
      };
    case "customer_custom_approved":
      return {
        subject: `Tu mate personalizado pasó a producción · #${order.order_number}`,
        html: layout(
          `${heading("Tu personalizado pasó a producción")}${copy("Revisamos tu diseño y está todo pronto. Nuestro equipo ya comenzó a trabajar en tu pieza personalizada.")}${orderRow}${products}${totalRow}${summaryRow("Tiempo estimado", "3 a 5 días hábiles")}${button("Seguir pedido", orderUrl)}`,
          siteUrl,
        ),
      };
    case "customer_order_ready":
      return {
        subject: `Tu pedido #${order.order_number} está pronto`,
        html: layout(
          `${heading("Tu pedido está pronto")}${copy("¡Buenas noticias! Tu pedido ya está preparado. Podés retirarlo en nuestro local o esperar la coordinación de entrega indicada al comprar.")}${orderRow}${summaryRow("Retiro", "25 de Mayo 1734")}${summaryRow("Horario", "Lun a vie · 10 a 18 h")}${button("Ver pedido", orderUrl)}`,
          siteUrl,
        ),
      };
    case "customer_order_shipped":
      return {
        subject: `Enviamos tu pedido #${order.order_number}`,
        html: layout(
          `${heading("Tu pedido ya está en camino")}${copy("Despachamos tu compra y pronto estará contigo. Podés seguir el recorrido con los datos de envío.")}${orderRow}${summaryRow("Transportista", shippingCarrier)}${summaryRow("Seguimiento", trackingCode)}${button("Seguir envío", trackingUrl || orderUrl)}`,
          siteUrl,
        ),
      };
    case "admin_payment_confirmed":
      return {
        subject: `Pago confirmado · Pedido #${order.order_number}`,
        html: layout(
          `${heading("Pago confirmado")}${copy(`Hola ${greetingName}! El pago del pedido fue aprobado y comenzaremos a prepararlo.`)}${orderRow}${products}${totalRow}${button("Gestionar pedido", adminUrl)}`,
          siteUrl,
        ),
      };
    default:
      throw new Error(`Tipo de correo no soportado: ${job.event_type}`);
  }
}
