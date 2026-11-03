import { useEffect, useMemo, useState } from "react";
import { buildCommerceEmail, type CommerceEmailEventType, type EmailOrder, type EmailOrderItem } from "../../supabase/functions/commerce-email/templates";
import { buildBirthdayEmail, buildWelcomeEmail } from "../../supabase/functions/lifecycle-email/templates";
import { newsletterConfirmationEmail } from "../../paginaweb/src/lib/newsletter-confirmation-email";
import { callMarketing } from "./marketingApi";

type Preview = { subject: string; html: string };
type Template = { id: string; name: string; provider: "Resend"; trigger: string; recipient: string; preview?: () => Preview; detail?: string };
type HostedTemplate = { id: string; name: string; alias?: string; status?: string };
const siteUrl = "https://www.matearteuruguay.com";
const order: EmailOrder = {
  id: "00000000-0000-0000-0000-000000000001", order_number: 123, status: "paid", total_minor: 265000,
  items_subtotal_minor: 250000, shipping_minor: 40000, payment_fee_minor: 0, discount_code: "CUPON10", discount_minor: 25000,
  currency: "UYU", shipping_method: "shipping", shipping_snapshot: {}, customer_snapshot: { fullName: "Cliente de ejemplo", purchaseFlow: "international_paypal" },
};
const items: EmailOrderItem[] = [{ item_type: "catalog", title: "Mate de ejemplo", quantity: 1, total_minor: 250000 }];
const transferOrder: EmailOrder = {
  ...order, items_subtotal_minor: 225000, shipping_minor: 0, discount_code: "BIENVENIDA10",
  discount_minor: 22500, total_minor: 202500,
  customer_snapshot: { fullName: "Cliente de ejemplo", purchaseFlow: "uruguay_retail_transfer", priceSource: "published_discount_10", transferDiscountPercent: 10 },
};
const transferItems: EmailOrderItem[] = [{ ...items[0], unit_price_minor: 225000, total_minor: 225000, immutable_snapshot: { variant: { price_minor: 250000 } } }];
const commerce = (eventType: CommerceEmailEventType): (() => Preview) => () => {
  const transfer = ["customer_payment_confirmed", "admin_payment_confirmed", "admin_payment_review_required"].includes(eventType);
  return buildCommerceEmail(
    { event_type: eventType, payload: { trackingCode: "ABC123", shippingCarrier: "Correo", trackingUrl: `${siteUrl}/pedidos/ejemplo` } },
    transfer ? transferOrder : order, transfer ? transferItems : items, siteUrl,
  );
};

const codeTemplates: Template[] = [
  { id: "newsletter-confirmation", name: "Confirmación de suscripción y descuento", provider: "Resend", trigger: "La persona solicita el beneficio de bienvenida desde la web.", recipient: "Cliente", preview: () => newsletterConfirmationEmail(`${siteUrl}/newsletter/confirmar?token=ejemplo`, siteUrl) },
  { id: "customer-order-received", name: "Pedido recibido", provider: "Resend", trigger: "Se confirma una compra por Mercado Pago o PayPal.", recipient: "Cliente", preview: commerce("customer_order_received") },
  { id: "customer-payment-confirmed", name: "Pago confirmado", provider: "Resend", trigger: "Se aprueba un pago por transferencia en Uruguay o Argentina.", recipient: "Cliente", preview: commerce("customer_payment_confirmed") },
  { id: "customer-custom-approved", name: "Personalizado aprobado", provider: "Resend", trigger: "Se aprueba un diseño personalizado para producción.", recipient: "Cliente", preview: commerce("customer_custom_approved") },
  { id: "customer-order-ready", name: "Pedido pronto", provider: "Resend", trigger: "El pedido queda listo para retiro o entrega.", recipient: "Cliente", preview: commerce("customer_order_ready") },
  { id: "customer-order-shipped", name: "Pedido enviado", provider: "Resend", trigger: "Se despacha un pedido con datos de seguimiento.", recipient: "Cliente", preview: commerce("customer_order_shipped") },
  { id: "admin-payment-confirmed", name: "Pago confirmado", provider: "Resend", trigger: "Se confirma el pago de un pedido.", recipient: "Equipo", preview: commerce("admin_payment_confirmed") },
  { id: "admin-payment-review-required", name: "Pago pendiente de confirmación", provider: "Resend", trigger: "Se recibe el comprobante de una transferencia y el pago espera revisión.", recipient: "Equipo", preview: commerce("admin_payment_review_required") },
  { id: "welcome", name: "Bienvenida a MateArte", provider: "Resend", trigger: "Se crea el perfil del cliente.", recipient: "Cliente", preview: () => buildWelcomeEmail({ recipient_email: "ejemplo@matearte.uy", payload: { name: "Cliente" } }, siteUrl) },
  { id: "birthday", name: "Cumpleaños", provider: "Resend", trigger: "Se acerca el cumpleaños de un cliente con fecha registrada.", recipient: "Cliente", preview: () => buildBirthdayEmail({ recipient_email: "ejemplo@matearte.uy", payload: { name: "Cliente", discountCode: "CUMPLE-EJEMPLO", discountPercent: "20%", discountValidity: "30 días" } }, siteUrl) },
  { id: "marketing-campaign", name: "Campaña de marketing", provider: "Resend", trigger: "Se envía manualmente una campaña a las personas con correo que no se dieron de baja.", recipient: "Clientes y contactos", detail: "El asunto y contenido cambian en cada campaña. Se consultan en la pestaña Campañas." },
];

export function EmailTemplatesPage() {
  const [hosted, setHosted] = useState<HostedTemplate[]>([]);
  const [selected, setSelected] = useState<string>(codeTemplates[0].id);
  const [hostedPreview, setHostedPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState("");
  useEffect(() => {
    let active = true;
    void callMarketing<{ templates: HostedTemplate[] }>("emailTemplates")
      .then(({ templates }) => { if (active) setHosted(Array.isArray(templates) ? templates : []); })
      .catch(() => { if (active) setHosted([]); });
    return () => { active = false; };
  }, []);
  const templates = useMemo(() => [
    ...codeTemplates,
    ...hosted.map((item): Template => ({ id: `resend-${item.id}`, name: item.name || item.alias || "Plantilla de Resend", provider: "Resend", trigger: "Plantilla guardada en Resend; el evento depende de dónde se use.", recipient: "Según uso", detail: `Guardada en Resend · ${item.status === "published" ? "Publicada" : "Borrador"}` })),
  ], [hosted]);
  const current = templates.find((item) => item.id === selected) || templates[0];
  const preview = current?.preview?.() || hostedPreview;
  const select = (item: Template) => {
    setSelected(item.id); setHostedPreview(null); setPreviewError("");
    if (!item.id.startsWith("resend-")) return;
    void callMarketing<{ template: { subject?: string; html?: string } }>("emailTemplate", { id: item.id.slice(7) })
      .then(({ template }) => setHostedPreview(template.html ? { subject: template.subject || item.name, html: template.html } : null))
      .catch(() => setPreviewError("No se pudo abrir esta plantilla."));
  };
  return <div className="email-templates-page">
    <p className="email-templates-intro">Correos que MateArte envía por eventos y plantillas configuradas en los proveedores. Las vistas previas usan datos de ejemplo y no envían mensajes.</p>
    <div className="email-templates-layout">
      <div className="email-templates-list">
        {([['Mails a clientes', false], ['Mails internos', true]] as const).map(([label, internal]) => <section className="email-template-group" aria-label={label} key={label}>
          <h3>{label}</h3>
          {codeTemplates.filter((item) => (item.recipient === 'Equipo') === internal).map((item) => <button type="button" key={item.id} className={selected === item.id ? "active" : ""} onClick={() => select(item)}><strong>{item.name}</strong><small>{item.trigger}</small></button>)}
        </section>)}
        {templates.filter((item) => item.id.startsWith("resend-")).map((item) => <button type="button" key={item.id} className={selected === item.id ? "active" : ""} onClick={() => select(item)}><strong>{item.name}</strong><small>{item.detail}</small></button>)}
      </div>
      <section className="email-template-detail" aria-label="Detalle de la plantilla">
        <div className="email-template-detail-head"><h2>{current.name}</h2><p>{current.trigger}</p><small>Destinatario: {current.recipient}</small></div>
        {preview ? <><p className="email-template-subject"><strong>Asunto:</strong> {preview.subject}</p><iframe title={`Vista previa de ${current.name}`} sandbox="" srcDoc={preview.html} /></> : <p className="email-templates-empty">{previewError || current.detail || "El contenido de esta plantilla se consulta en Resend."}</p>}
      </section>
    </div>
  </div>;
}
