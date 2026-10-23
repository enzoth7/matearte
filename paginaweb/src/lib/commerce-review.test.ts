// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ paypal: vi.fn(), mp: vi.fn() }));
vi.mock("./paypal", () => ({ refundPayPalCapture: mocks.paypal }));
vi.mock("mercadopago", () => ({ MercadoPagoConfig: class {}, PaymentRefund: class { total = mocks.mp; } }));
import { reviewCommerceOrder } from "./commerce-review";
const input = { orderId: "order", decision: "reject" as const, reason: "No se puede fabricar", actor: "staff" };
const attempt = { id: "f1a04858-ed0b-42c6-8dbd-2461374d11f4", provider: "paypal", provider_payment_id: "CAPTURE", status: "pending", dispatch: true };
function client(value = attempt) { return { rpc: vi.fn().mockResolvedValueOnce({ data: value }).mockResolvedValue({ data: { status: "completed" } }) }; }
beforeEach(() => vi.clearAllMocks());
describe("revisión y reembolso", () => {
  it("usa PayPal y la clave persistente; confirma solo después del proveedor", async () => {
    const admin = client(); mocks.paypal.mockResolvedValue({ id: "REFUND", status: "COMPLETED" });
    expect(await reviewCommerceOrder(admin as unknown as SupabaseClient, input)).toMatchObject({ pending: false });
    expect(mocks.paypal).toHaveBeenCalledWith("CAPTURE", attempt.id);
    expect(mocks.mp).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenLastCalledWith("finish_commerce_refund", expect.objectContaining({ p_completed: true }));
  });
  it("no repite una devolución incierta ni marca el pedido reembolsado", async () => {
    const admin = client(); mocks.paypal.mockRejectedValue(new Error("timeout"));
    expect(await reviewCommerceOrder(admin as unknown as SupabaseClient, input)).toMatchObject({ pending: true });
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    const retry = client({ ...attempt, dispatch: false });
    expect(await reviewCommerceOrder(retry as unknown as SupabaseClient, input)).toMatchObject({ pending: true });
    expect(mocks.paypal).toHaveBeenCalledTimes(1);
  });
  it("mantiene transferencias manuales y respuestas PENDING sin confirmar", async () => {
    const bank = client({ ...attempt, status: "manual", dispatch: false });
    expect(await reviewCommerceOrder(bank as unknown as SupabaseClient, input)).toMatchObject({ pending: true });
    expect(mocks.paypal).not.toHaveBeenCalled();
    const admin = client(); mocks.paypal.mockResolvedValue({ id: "REFUND", status: "PENDING" });
    await reviewCommerceOrder(admin as unknown as SupabaseClient, input);
    expect(admin.rpc).toHaveBeenLastCalledWith("finish_commerce_refund", expect.objectContaining({ p_completed: false }));
  });
  it("usa Mercado Pago únicamente para sus pagos", async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "test";
    const admin = client({ ...attempt, provider: "mercado_pago" });
    mocks.mp.mockResolvedValue({ id: 123, status: "approved" });
    expect(await reviewCommerceOrder(admin as unknown as SupabaseClient, input)).toMatchObject({ pending: false });
    expect(mocks.paypal).not.toHaveBeenCalled();
    expect(mocks.mp).toHaveBeenCalledWith(expect.objectContaining({ requestOptions: { idempotencyKey: attempt.id } }));
  });
});
