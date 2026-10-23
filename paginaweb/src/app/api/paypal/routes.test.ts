// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ user: { id: "buyer" } as { id: string } | null, lookup: {} as Record<string, unknown>, save: {} as Record<string, unknown>, rpc: vi.fn(), capture: vi.fn(), create: vi.fn(), verify: vi.fn(), email: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  requireUser: async () => ({ user: mock.user }),
  createAdminSupabase: () => ({ rpc: mock.rpc, from: () => {
    let saving = false;
    const chain = { select: () => chain, eq: (...args: unknown[]) => { mock.eq(...args); return chain; }, update: () => { saving = true; return chain; }, single: async () => saving ? mock.save : mock.lookup, maybeSingle: async () => mock.lookup };
    return chain;
  } }),
}));
vi.mock("@/lib/paypal", () => ({ capturePayPalOrder: mock.capture, createPayPalOrder: mock.create, verifyPayPalWebhookSignature: mock.verify }));
vi.mock("@/lib/commerce-email", () => ({ dispatchCommerceEmails: mock.email }));
import { POST as capture } from "./capture-order/route";
import { POST as create } from "./create-order/route";
import { POST as webhook } from "../webhooks/paypal/route";
const request = (body: unknown) => new Request("https://store.test/api/paypal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const eventRequest = (body: unknown) => new Request("https://store.test/api/webhooks/paypal", { method: "POST", headers: Object.fromEntries(["auth-algo", "cert-url", "transmission-id", "transmission-sig", "transmission-time"].map(key => [`paypal-${key}`, "test"])), body: JSON.stringify(body) });
const event = { id: "EVENT", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAPTURE", status: "COMPLETED", amount: { currency_code: "USD", value: "100.00" }, supplementary_data: { related_ids: { order_id: "PAYPAL" } } } };
beforeEach(() => {
  vi.clearAllMocks(); mock.user = { id: "buyer" }; mock.lookup = { data: { id: "order", user_id: "buyer", status: "pending_payment", paypal_amount_usd_minor: 10000 } }; mock.save = { data: { id: "order" } };
  mock.verify.mockResolvedValue(true); mock.rpc.mockResolvedValue({ data: { orderId: "order" }, error: null }); mock.create.mockResolvedValue({ id: "PAYPAL" });
  mock.capture.mockResolvedValue({ status: "COMPLETED", purchase_units: [{ payments: { captures: [event.resource] } }] });
  process.env.PAYPAL_WEBHOOK_ID = "test";
});
describe("PayPal captura y creación", () => {
  it("filtra por propietario antes de llamar a PayPal", async () => {
    mock.lookup = { data: null };
    expect((await capture(request({ orderID: "PAYPAL" }))).status).toBe(404);
    expect(mock.eq).toHaveBeenCalledWith("user_id", "buyer");
    expect(mock.capture).not.toHaveBeenCalled();
  });
  it("rechaza pedidos cancelados o reembolsados y admite reintento de un cobro confirmado", async () => {
    mock.lookup = { data: { status: "refunded", paid_at: "now" } };
    expect((await capture(request({ orderID: "PAYPAL" }))).status).toBe(409);
    mock.lookup = { data: { status: "ready_for_production", paid_at: "now" } };
    expect(await (await capture(request({ orderID: "PAYPAL" }))).json()).toMatchObject({ status: "COMPLETED" });
    expect(mock.capture).not.toHaveBeenCalled();
  });
  it("no confirma si falla la persistencia ni acepta moneda incorrecta", async () => {
    mock.rpc.mockResolvedValue({ error: new Error("database unavailable") });
    expect((await capture(request({ orderID: "PAYPAL" }))).status).toBe(500);
    mock.capture.mockResolvedValue({ status: "COMPLETED", purchase_units: [{ payments: { captures: [{ ...event.resource, amount: { currency_code: "EUR", value: "100.00" } }] } }] });
    mock.rpc.mockClear();
    expect((await capture(request({ orderID: "PAYPAL" }))).status).toBe(500);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("no entrega una orden PayPal si no se pudo asociar en la base", async () => {
    mock.save = { error: new Error("database unavailable") };
    expect((await create(request({ orderId: "order" }))).status).toBe(500);
  });
  it("no reutiliza una orden PayPal cancelada", async () => {
    mock.lookup = { data: { status: "cancelled", paypal_order_id: "PAYPAL" } };
    expect((await create(request({ orderId: "order" }))).status).toBe(400);
    expect(mock.create).not.toHaveBeenCalled();
  });
});
describe("avisos PayPal", () => {
  it("devuelve error recuperable ante fallo de base, y éxito al reintentar", async () => {
    mock.rpc.mockResolvedValueOnce({ error: new Error("database unavailable") });
    expect((await webhook(eventRequest(event))).status).toBe(500);
    expect((await webhook(eventRequest(event))).status).toBe(200);
    expect(mock.rpc).toHaveBeenLastCalledWith("process_paypal_payment", expect.objectContaining({ p_event_id: "EVENT", p_amount_usd_minor: 10000 }));
  });
  it("rechaza firmas inválidas y eventos incompletos sin confirmar recepción", async () => {
    mock.verify.mockResolvedValueOnce(false);
    expect((await webhook(eventRequest(event))).status).toBe(401);
    expect((await webhook(eventRequest({ ...event, resource: { ...event.resource, supplementary_data: {} } }))).status).toBe(500);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("correlaciona reembolsos por captura y propaga fallos", async () => {
    const refund = { id: "REFUNDEVENT", event_type: "PAYMENT.CAPTURE.REFUNDED", resource: { id: "REFUND", status: "COMPLETED", amount: { currency_code: "USD", value: "100.00" }, links: [{ rel: "up", href: "https://api.paypal.com/v2/payments/captures/CAPTURE" }] } };
    expect((await webhook(eventRequest(refund))).status).toBe(200);
    expect(mock.rpc).toHaveBeenLastCalledWith("process_paypal_refund", expect.objectContaining({ p_capture_id: "CAPTURE", p_refund_id: "REFUND", p_amount_usd_minor: 10000 }));
    mock.rpc.mockResolvedValueOnce({ error: new Error("database unavailable") });
    expect((await webhook(eventRequest(refund))).status).toBe(500);
  });
});
