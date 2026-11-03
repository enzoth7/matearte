import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCommerceEmail,
  COMMERCE_EMAIL_EVENT_TYPES,
  type EmailOrder,
  type EmailOrderItem,
} from "./templates.ts";

test("Argentine transfers preserve ARS without a shipping line", () => {
  const message = buildCommerceEmail(
    { event_type: "customer_payment_confirmed", payload: {} },
    { ...order, currency: "ARS", total_minor: 300000, items_subtotal_minor: 300000, shipping_minor: 0,
      customer_snapshot: { purchaseFlow: "argentina_retail_transfer" } },
    [],
    "https://www.matearteuruguay.com",
    "test-token",
  );
  assert.match(message.html, /ARS/);
  assert.doesNotMatch(message.html, />Envío</);
});

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

test("commerce email catalog includes the customer payment confirmation", () => {
  assert.deepEqual([...COMMERCE_EMAIL_EVENT_TYPES], [
    "customer_order_received",
    "customer_payment_confirmed",
    "customer_custom_approved",
    "customer_order_ready",
    "customer_order_shipped",
    "admin_payment_confirmed",
    "admin_payment_review_required",
  ]);
});

test("order received matches the approved Figma copy and hierarchy", () => {
  const message = buildCommerceEmail(
    { event_type: "customer_order_received", payload: {} },
    { ...order, customer_snapshot: { ...order.customer_snapshot, purchaseFlow: "international_paypal" } },
    items,
    "https://www.matearteuruguay.com",
    "token",
  );

  assert.equal(message.subject, "Recibimos tu pedido #1048");
  assert.match(message.html, /Recibimos tu pedido/);
  assert.match(message.html, /Recibimos tu pedido y ya podés seguir su estado/);
  assert.doesNotMatch(message.html, /te avisaremos cuando confirmemos el pago/);
  assert.match(message.html, />Pedido</);
  assert.match(message.html, />#1048</);
  assert.match(message.html, />Subtotal</);
  assert.match(message.html, />Envío</);
  assert.match(message.html, />Total</);
  assert.match(message.html, />VER ESTADO DEL PEDIDO</);
  assert.match(message.html, /href="https:\/\/www\.matearteuruguay\.com\/pedidos\/00000000-0000-0000-0000-000000000001#access=token"/);
});

const summaryValue = (html: string, label: string) => html.match(new RegExp(`>${label}</td>\\s*<td[^>]*>([^<]+)</td>`))?.[1];

test("one total discount combines the Uruguay transfer reduction and coupon", () => {
  const transferOrder: EmailOrder = {
    ...order, items_subtotal_minor: 729000, discount_code: "BIENVENIDA10", discount_minor: 72900,
    shipping_minor: 0, total_minor: 656100,
    customer_snapshot: { purchaseFlow: "uruguay_retail_transfer", priceSource: "published_discount_10", transferDiscountPercent: 10 },
  };
  const transferItems: EmailOrderItem[] = [
    [110000, 99000], [140000, 126000], [295000, 265500], [265000, 238500],
  ].map(([original, charged]) => ({ item_type: "catalog", title: "Producto", quantity: 1,
    unit_price_minor: charged, total_minor: charged, immutable_snapshot: { variant: { price_minor: original } } }));
  for (const event_type of ["customer_payment_confirmed", "admin_payment_confirmed", "admin_payment_review_required"] as const) {
    const html = buildCommerceEmail({ event_type, payload: {} }, transferOrder, transferItems, "https://www.matearteuruguay.com").html;
    assert.equal(summaryValue(html, "Subtotal"), "UYU 8.100");
    assert.equal(summaryValue(html, "Descuento total"), "−UYU 1.539");
    assert.equal(summaryValue(html, "Total"), "UYU 6.561");
    assert.equal(summaryValue(html, "Envío"), undefined);
    assert.doesNotMatch(html, />Descuento · BIENVENIDA10</);
  }
});

test("Mercado Pago shows a coupon without shipping; PayPal shows its charged shipping", () => {
  const discountedOrder = { ...order, items_subtotal_minor: 250000, discount_code: "CUPON",
    discount_minor: 25000, shipping_minor: 0, total_minor: 225000 };
  const mercadoPago = buildCommerceEmail({ event_type: "customer_order_received", payload: {} },
    discountedOrder, [{ ...items[0], total_minor: 250000 }], "https://www.matearteuruguay.com").html;
  assert.equal(summaryValue(mercadoPago, "Descuento total"), "−UYU 250");
  assert.equal(summaryValue(mercadoPago, "Total"), "UYU 2.250");
  assert.equal(summaryValue(mercadoPago, "Envío"), undefined);
  const paypal = buildCommerceEmail({ event_type: "customer_order_received", payload: {} },
    { ...discountedOrder, shipping_minor: 40000, total_minor: 265000,
      customer_snapshot: { purchaseFlow: "international_paypal" } }, items, "https://www.matearteuruguay.com").html;
  assert.equal(summaryValue(paypal, "Descuento total"), "−UYU 250");
  assert.equal(summaryValue(paypal, "Envío"), "UYU 400");
  assert.equal(summaryValue(paypal, "Total"), "UYU 2.650");
});

test("wholesale transfer exposes the saved reduction as part of total discount", () => {
  const html = buildCommerceEmail({ event_type: "customer_payment_confirmed", payload: {} },
    { ...order, items_subtotal_minor: 210000, shipping_minor: 0, total_minor: 210000,
      customer_snapshot: { purchaseFlow: "wholesale_bank_transfer" } },
    [{ item_type: "catalog", title: "Mate mayorista", quantity: 1,
      unit_price_minor: 210000, total_minor: 210000,
      immutable_snapshot: { wholesaleBankTransfer: true, variant: { base_price_minor: 300000 } } }],
    "https://www.matearteuruguay.com").html;
  assert.equal(summaryValue(html, "Subtotal"), "UYU 3.000");
  assert.equal(summaryValue(html, "Descuento total"), "−UYU 900");
  assert.equal(summaryValue(html, "Envío"), undefined);
});

test("every email button points to its verified destination", () => {
  const siteUrl = "https://www.matearteuruguay.com";
  const orderHref = `${siteUrl}/pedidos/${order.id}#access=secure-token`;
  const customerEvents = [
    "customer_order_received",
    "customer_payment_confirmed",
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
    ["admin_payment_confirmed", "Pago confirmado", "Hola Richard! El pago del pedido fue aprobado.", "GESTIONAR PEDIDO"],
    ["admin_payment_review_required", "Pago pendiente de confirmación", "Hola Richard! Hay un pedido que está pendiente de confirmación.", "GESTIONAR PEDIDO"],
    ["customer_payment_confirmed", "Pago confirmado", "comenzaremos a prepararlo", "VER ESTADO DEL PEDIDO"],
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
