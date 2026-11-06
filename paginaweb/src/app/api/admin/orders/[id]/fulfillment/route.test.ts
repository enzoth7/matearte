import { beforeEach, describe, expect, it, vi } from "vitest";

const { dispatchCommerceEmails, createAdminSupabase } = vi.hoisted(() => ({
  dispatchCommerceEmails: vi.fn(),
  createAdminSupabase: vi.fn(),
}));

vi.mock("@/lib/commerce-email", () => ({ dispatchCommerceEmails }));
vi.mock("@/lib/supabase/config", () => ({ isAllowedCommerceAdminOrigin: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabase,
  getFirstPartyTokenUser: async () => ({ id: "admin" }),
}));

import { PATCH } from "./route";

const id = "91628198-49a0-4e79-b09d-1d9aa8827d88";

function request(action: string, details: Record<string, string> = {}) {
  return new Request(`https://www.matearteuruguay.com/api/admin/orders/${id}/fulfillment`, {
    method: "PATCH",
    headers: { origin: "https://gestion.matearteuruguay.com", authorization: "Bearer test", "content-type": "application/json" },
    body: JSON.stringify({ action, ...details }),
  });
}

function adminFor(order: Record<string, unknown>) {
  const update = vi.fn((value: Record<string, unknown>) => ({
    eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id, ...value }, error: null }) }) }) }),
  }));
  createAdminSupabase.mockReturnValue({
    from: (table: string) => table === "commerce_admin_users"
      ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "admin" } }) }) }) }) }
      : { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: order, error: null }) }) }), update },
  });
  return update;
}

describe("entrega desde Gestión", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("convierte un envío nacional en retiro entregado sin despachar correo", async () => {
    const update = adminFor({ id, status: "paid_pending_review", channel: "Web", shipping_method: "national_shipping", shipping_snapshot: { name: "Envío a domicilio" }, order_items: [] });
    const response = await PATCH(request("deliver_in_store"), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(createAdminSupabase).toHaveBeenCalledWith("admin");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "delivered", shipping_method: "pickup", shipping_carrier: null, tracking_code: null }));
    expect(dispatchCommerceEmails).not.toHaveBeenCalled();
  });

  it("registra el retiro de una venta manual aunque se hubiese anotado como envío", async () => {
    const update = adminFor({ id, status: "internal_completed", channel: "WhatsApp", shipping_method: "national_shipping", shipping_snapshot: {}, order_items: [] });
    const response = await PATCH(request("deliver_in_store"), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "delivered", shipping_method: "pickup", shipped_at: null }));
    expect(dispatchCommerceEmails).not.toHaveBeenCalled();
  });

  it("permite entregar una venta local pendiente de producción", async () => {
    const order = { id, status: "internal_completed", channel: "Local", shipping_method: "pickup", order_items: [
      { item_type: "catalog", production_status: "pending", immutable_snapshot: { customization: { itemKind: "custom_mate" } } },
      { item_type: "catalog", production_status: "pending", immutable_snapshot: {} },
    ] };
    const update = adminFor(order);
    const completed = await PATCH(request("deliver"), { params: Promise.resolve({ id }) });
    expect(completed.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "delivered" }));
    expect(dispatchCommerceEmails).not.toHaveBeenCalled();
  });

  it("marca enviado un retiro y permite entregarlo después", async () => {
    const order = { id, status: "ready_for_production", channel: "Web", shipping_method: "pickup", shipping_snapshot: {}, order_items: [] };
    const update = adminFor(order);
    const shipped = await PATCH(request("ship", { deliveryMethod: "pickup" }), { params: Promise.resolve({ id }) });
    expect(shipped.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "shipped", shipping_method: "pickup", shipping_carrier: null, tracking_code: null }));
    expect(dispatchCommerceEmails).toHaveBeenCalledWith(id);
    order.status = "shipped";
    const delivered = await PATCH(request("deliver"), { params: Promise.resolve({ id }) });
    expect(delivered.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "delivered" }));
  });

  it("despacha una venta por WhatsApp aunque todavía figure en producción", async () => {
    const update = adminFor({ id, status: "internal_completed", channel: "WhatsApp", shipping_method: "pickup", shipping_snapshot: {}, order_items: [
      { item_type: "catalog", production_status: "pending", immutable_snapshot: { customization: { itemKind: "custom_mate" } } },
    ] });
    const shipped = await PATCH(request("ship", { deliveryMethod: "shipping", shippingCarrier: "Correo", trackingCode: "TRACK-001" }), { params: Promise.resolve({ id }) });
    expect(shipped.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "shipped", shipping_method: "national_shipping", shipping_carrier: "Correo", tracking_code: "TRACK-001" }));
    expect(dispatchCommerceEmails).toHaveBeenCalledWith(id);
  });

  it("permite un envío manual sin seguimiento", async () => {
    const update = adminFor({ id, status: "internal_completed", channel: "Instagram", shipping_method: "pickup", shipping_snapshot: {}, order_items: [] });
    const shipped = await PATCH(request("ship", { deliveryMethod: "shipping" }), { params: Promise.resolve({ id }) });
    expect(shipped.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "shipped", shipping_method: "national_shipping", shipping_carrier: null, tracking_code: null }));
  });
});
