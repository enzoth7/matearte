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

function request(action: string) {
  return new Request(`https://www.matearteuruguay.com/api/admin/orders/${id}/fulfillment`, {
    method: "PATCH",
    headers: { origin: "https://gestion.matearteuruguay.com", authorization: "Bearer test", "content-type": "application/json" },
    body: JSON.stringify({ action }),
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

  it("exige producción terminada para entregar una venta local", async () => {
    const order = { id, status: "internal_completed", channel: "Local", shipping_method: "pickup", order_items: [
      { item_type: "catalog", production_status: "pending", immutable_snapshot: { customization: { itemKind: "custom_mate" } } },
      { item_type: "catalog", production_status: "pending", immutable_snapshot: {} },
    ] };
    const update = adminFor(order);
    const pending = await PATCH(request("deliver"), { params: Promise.resolve({ id }) });
    expect(pending.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
    order.order_items[0].production_status = "completed";
    const completed = await PATCH(request("deliver"), { params: Promise.resolve({ id }) });
    expect(completed.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "delivered" }));
    expect(dispatchCommerceEmails).not.toHaveBeenCalled();
  });
});
