import { describe, expect, it } from "vitest";
import { buildCommerceEmail } from "../../../supabase/functions/commerce-email/templates";

const order = {
  id: "11111111-1111-4111-8111-111111111111",
  order_number: 42,
  status: "pending_payment",
  total_minor: 620000,
  currency: "UYU",
  shipping_method: "national_shipping",
  shipping_snapshot: {},
  customer_snapshot: { fullName: "Ana & Juan", email: "cliente@example.com" },
};

const items = [{ item_type: "design" as const, title: "Imperial <único>", quantity: 1, total_minor: 620000, review_reason: "El grabado no es viable." }];

const events = [
  "customer_order_received",
  "customer_payment_confirmed",
  "customer_custom_approved",
  "customer_custom_rejected_refunded",
  "customer_order_ready",
  "customer_order_shipped",
  "customer_international_received",
  "customer_payment_failed",
  "customer_order_cancelled",
  "customer_order_refunded",
  "admin_order_created",
  "admin_payment_confirmed",
  "admin_custom_review_required",
  "admin_payment_review_required",
];

describe("plantillas de correos comerciales", () => {
  it.each(events)("genera asunto y HTML para %s", (eventType) => {
    const email = buildCommerceEmail({ event_type: eventType, payload: { trackingCode: "UY123", trackingUrl: "https://correo.example/track" } }, order, items, "https://matearte.vercel.app");
    expect(email.subject).toContain("42");
    expect(email.html).toContain("MateArte");
    expect(email.html).not.toContain("Imperial <único>");
  });

  it("identifica explícitamente los diseños como mates personalizados", () => {
    const email = buildCommerceEmail({ event_type: "customer_order_received", payload: {} }, order, items, "https://matearte.vercel.app");
    expect(email.html).toContain("Mate personalizado");
    expect(email.html).toContain("Imperial &lt;único&gt;");
  });
});
