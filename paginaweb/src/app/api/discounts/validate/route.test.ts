// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mock = vi.hoisted(() => ({ rpc: vi.fn(), cart: vi.fn(), settings: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  requireUser: async () => ({ user: { id: "buyer" } }),
  createAdminSupabase: () => ({ rpc: mock.rpc, from: () => ({ select: () => ({ eq: () => ({ single: mock.settings }) }) }) }),
}));
vi.mock("@/lib/cart", () => ({ readPricedCart: mock.cart }));
vi.mock("@/lib/argentina-server", () => ({
  getArgentinaSettings: async () => ({ ars_per_uyu: 30 }),
  getArgentinaBasePricing: async () => false,
}));
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mock.cart.mockResolvedValue({ wholesale: { eligible: false }, items: [
    { item_type: "catalog", unit_price_minor: 10000, quantity: 2, variant: { product: { category_code: "mates" } } },
    { item_type: "catalog", unit_price_minor: 30000, quantity: 1, variant: { product: { category: "personalizados" } } },
    { item_type: "design", unit_price_minor: 40000, quantity: 1 },
  ] });
  mock.rpc.mockResolvedValue({ data: { discountMinor: 2000 }, error: null });
  mock.settings.mockResolvedValue({ data: {
    uruguay_transfer_discount_enabled: true,
    uruguay_transfer_discount_categories: ["mates"],
    uruguay_transfer_discount_designs: true,
  }, error: null });
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

it("validates Uruguay transfer coupons against 90% of published catalog and design prices", async () => {
  mock.cart.mockResolvedValue({ wholesale: { eligible: false }, items: [
    { item_type: "catalog", unit_price_minor: 11365, catalog_base_unit_price_minor: 10000, quantity: 2, variant: { product: { category_code: "mates" } } },
    { item_type: "design", unit_price_minor: 1015, quantity: 1 },
  ] });
  const response = await POST(new Request("https://store.test/api/discounts/validate", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: "MATE10", currency: "UYU", paymentMethod: "bank_transfer" }),
  }));
  expect(response.status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith("validate_commerce_discount_scoped", {
    p_user_id: "buyer", p_code: "MATE10", p_items_subtotal_minor: 21372,
    p_design_subtotal_minor: 914, p_category_subtotals: { mates: 20458 },
  });
});

it("returns a non-applicable response when no selected products qualify", async () => {
  mock.rpc.mockResolvedValue({ error: { message: "discount:not_applicable" } });
  const response = await POST(request());
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ details: { reason: "not_applicable" } });
});

it("quotes a fixed UYU coupon in rounded ARS using Argentina's priced categories", async () => {
  mock.rpc.mockResolvedValue({ data: {
    code: "MATE10", discountType: "fixed", discountValue: 100,
    applicability: "categories", categoryCodes: ["mates"], includeDesignItems: false,
    discountMinor: 10000,
  }, error: null });
  const response = await POST(new Request("https://store.test/api/discounts/validate", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: "MATE10", currency: "ARS" }),
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    currency: "ARS", discountMinor: 300000, itemsSubtotalMinor: 2700000,
    discountedItemsSubtotalMinor: 2400000,
  });
});

const saleCart = () => ({
  wholesale: { eligible: false },
  storewide_sale: { active: true, percent: 20 },
  items: [{ item_type: "catalog", unit_price_minor: 8000, base_unit_price_minor: 10000, quantity: 2, variant: { product: { category_code: "mates" } } }],
});
const couponRequest = () => new Request("https://store.test/api/discounts/validate", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ code: "MATE10", currency: "UYU" }),
});

it("validates the code on list prices and keeps the general discount when it saves more", async () => {
  mock.cart.mockResolvedValue(saleCart());
  mock.rpc.mockResolvedValue({ data: { discountMinor: 4000 }, error: null });
  const response = await POST(couponRequest());
  expect(mock.rpc).toHaveBeenCalledWith("validate_commerce_discount_scoped", expect.objectContaining({ p_items_subtotal_minor: 20000 }));
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ details: { reason: "sale_better" } });
});

it("uses the code and flags the general discount as suspended when the code saves more", async () => {
  mock.cart.mockResolvedValue(saleCart());
  mock.rpc.mockResolvedValue({ data: { discountMinor: 4001, itemsSubtotalMinor: 20000, discountedItemsSubtotalMinor: 15999 }, error: null });
  const response = await POST(couponRequest());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ discountMinor: 4001, saleSuspended: true });
});

it("does not suspend anything when the general discount is off", async () => {
  mock.cart.mockResolvedValue({ ...saleCart(), storewide_sale: { active: false, percent: 0 } });
  mock.rpc.mockResolvedValue({ data: { discountMinor: 100 }, error: null });
  const response = await POST(couponRequest());
  expect(response.status).toBe(200);
  expect((await response.json()).saleSuspended).toBe(false);
});
