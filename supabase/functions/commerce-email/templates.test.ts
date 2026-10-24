import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCommerceEmail,
  COMMERCE_EMAIL_EVENT_TYPES,
  type EmailOrder,
  type EmailOrderItem,
} from "./templates.ts";

const order: EmailOrder = {
  id: "00000000-0000-0000-0000-000000000001",
  order_number: 1048,
  status: "ready_for_fulfillment",
  total_minor: 543000,
  items_subtotal_minor: 518000,
  shipping_minor: 25000,
  payment_fee_minor: 0,
  discount_code: null,
  discount_minor: 0,
  currency: "UYU",
  shipping_method: "national_shipping",
  shipping_snapshot: {},
  customer_snapshot: { fullName: "Ana", email: "ana@example.com" },
};

const items: EmailOrderItem[] = [{
  item_type: "catalog",
  title: "Mate Imperial Torpedo",
  quantity: 1,
  total_minor: 518000,
}];

test("commerce email catalog contains only the five useful transactional events", () => {
  assert.deepEqual([...COMMERCE_EMAIL_EVENT_TYPES], [
    "customer_order_received",
    "customer_custom_approved",
    "customer_order_ready",
    "customer_order_shipped",
    "admin_payment_confirmed",
  ]);
});

test("order received matches the approved Figma copy and hierarchy", () => {
  const message = buildCommerceEmail(
    { event_type: "customer_order_received", payload: {} },
    order,
    items,
    "https://www.matearteuruguay.com",
    "token",
  );

  assert.equal(message.subject, "Recibimos tu pedido #1048");
  assert.match(message.html, /Recibimos tu pedido/);
  assert.match(message.html, /Ya recibimos tu pedido y te avisaremos cuando confirmemos el pago/);
  assert.match(message.html, />Pedido</);
  assert.match(message.html, />#1048</);
  assert.match(message.html, />Subtotal</);
  assert.match(message.html, />Envío</);
  assert.match(message.html, />Total</);
  assert.match(message.html, />VER ESTADO DEL PEDIDO</);
  assert.match(message.html, /href="https:\/\/www\.matearteuruguay\.com\/pedidos\/00000000-0000-0000-0000-000000000001#access=token"/);
});

test("every email button points to its verified destination", () => {
  const siteUrl = "https://www.matearteuruguay.com";
  const orderHref = `${siteUrl}/pedidos/${order.id}#access=secure-token`;
  const customerEvents = [
    "customer_order_received",
    "customer_custom_approved",
    "customer_order_ready",
  ] as const;

  for (const event_type of customerEvents) {
    const message = buildCommerceEmail({ event_type, payload: {} }, order, items, siteUrl, "secure-token");
    assert.ok(message.html.includes(`href="${orderHref}"`));
  }

  const shippedWithUrl = buildCommerceEmail({
    event_type: "customer_order_shipped",
    payload: { trackingCode: "UY-804921", trackingUrl: "https://tracking.example/804921" },
  }, order, items, siteUrl, "secure-token");
  assert.match(shippedWithUrl.html, /href="https:\/\/tracking\.example\/804921"/);

  const shippedWithUrlAsCode = buildCommerceEmail({
    event_type: "customer_order_shipped",
    payload: { trackingCode: "https://tracking.example/code-link" },
  }, order, items, siteUrl, "secure-token");
  assert.match(shippedWithUrlAsCode.html, /href="https:\/\/tracking\.example\/code-link"/);

  const shippedWithPlainCode = buildCommerceEmail({
    event_type: "customer_order_shipped",
    payload: { trackingCode: "UY-804921", trackingUrl: "javascript:alert(1)" },
  }, order, items, siteUrl, "secure-token");
  assert.ok(shippedWithPlainCode.html.includes(`href="${orderHref}"`));

  const admin = buildCommerceEmail(
    { event_type: "admin_payment_confirmed", payload: {} },
    order,
    items,
    siteUrl,
    null,
    "https://admin.example/orders",
  );
  assert.match(admin.html, /href="https:\/\/admin\.example\/orders"/);
});

test("every supported commerce event renders an email", () => {
  for (const event_type of COMMERCE_EMAIL_EVENT_TYPES) {
    const message = buildCommerceEmail(
      { event_type, payload: {} },
      order,
      items,
      "https://www.matearteuruguay.com",
      "token",
    );
    assert.ok(message.subject.length > 0);
    assert.match(message.html, /<!doctype html>/);
    assert.match(message.html, />MateArte</);
    assert.match(message.html, /ARTE &amp; TRADICIÓN/);
    assert.match(message.html, /assets\/matearte\/home-v2\/logo\.png/);
    assert.match(message.html, /max-width:640px/);
    assert.match(message.html, /border:1px solid #bfab8c/);
    assert.doesNotMatch(message.html, /<\/?(?:p|span)\b/i);
  }
});

test("each transactional event uses the exact approved Figma message", () => {
  const cases = [
    ["customer_custom_approved", "Tu personalizado pasó a producción", "Tiempo estimado", "SEGUIR PEDIDO"],
    ["customer_order_ready", "Tu pedido está pronto", "25 de Mayo 1734", "VER PEDIDO"],
    ["customer_order_shipped", "Tu pedido ya está en camino", "UY-804921", "SEGUIR ENVÍO"],
    ["admin_payment_confirmed", "Pago confirmado", "comenzaremos a prepararlo", "GESTIONAR PEDIDO"],
  ] as const;

  for (const [event_type, title, detail, cta] of cases) {
    const message = buildCommerceEmail(
      {
        event_type,
        payload: event_type === "customer_order_shipped"
          ? { shippingCarrier: "DAC", trackingCode: "UY-804921", trackingUrl: "https://tracking.example/804921" }
          : {},
      },
      order,
      items,
      "https://www.matearteuruguay.com",
      "token",
    );
    assert.match(message.html, new RegExp(title));
    assert.match(message.html, new RegExp(detail));
    assert.match(message.html, new RegExp(cta));
  }
});
