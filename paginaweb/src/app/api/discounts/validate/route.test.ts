// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), cart: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  requireUser: async () => ({ user: { id: "buyer" } }),
  createAdminSupabase: () => ({ rpc: mock.rpc }),
}));
vi.mock("@/lib/cart", () => ({ readPricedCart: mock.cart }));
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mock.cart.mockResolvedValue({ wholesale: { eligible: false }, items: [
    { item_type: "catalog", unit_price_minor: 10000, quantity: 2, variant: { product: { category_code: "mates" } } },
    { item_type: "catalog", unit_price_minor: 30000, quantity: 1, variant: { product: { category: "personalizados" } } },
    { item_type: "design", unit_price_minor: 40000, quantity: 1 },
  ] });
  mock.rpc.mockResolvedValue({ data: { discountMinor: 2000 }, error: null });
});

const request = () => new Request("https://store.test/api/discounts/validate", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ code: " mate10 ", subtotalMinor: 1, categorySubtotals: { mates: 99999999 } }),
});

it("uses server prices and categories, ignoring totals supplied by the customer", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith("validate_commerce_discount_scoped", {
    p_user_id: "buyer", p_code: "MATE10", p_items_subtotal_minor: 90000,
    p_design_subtotal_minor: 40000, p_category_subtotals: { mates: 20000, personalizados: 30000 },
  });
});

it("returns a non-applicable response when no selected products qualify", async () => {
  mock.rpc.mockResolvedValue({ error: { message: "discount:not_applicable" } });
  const response = await POST(request());
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ details: { reason: "not_applicable" } });
});
