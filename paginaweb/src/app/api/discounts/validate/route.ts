import { apiError, apiOk, readJson } from "@/lib/api";
import { readPricedCart } from "@/lib/cart";
import { discountErrorMessage, discountReasonFromError, normalizeDiscountCode, type ValidatedDiscount } from "@/lib/discounts";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";
import { discountCategorySubtotals } from "../../../../../../shared/discount-scope";

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);

  try {
    const body = await readJson(request);
    const code = normalizeDiscountCode(body.code);
    if (!/^[A-Z0-9][A-Z0-9_-]{3,31}$/.test(code)) {
      return apiError("Ingresá un código válido.", 422, { reason: "invalid" });
    }

    const admin = createAdminSupabase();
    const cart = await readPricedCart(admin, user.id);
    if (cart.wholesale.eligible) {
      return apiError("Los códigos no se combinan con el beneficio mayorista.", 422, { reason: "not_applicable" });
    }
    const subtotalMinor = cart.items.reduce(
      (sum, item) => sum + Number(item.unit_price_minor) * Number(item.quantity),
      0,
    );
    const designSubtotalMinor = cart.items
      .filter((item) => item.item_type === "design")
      .reduce((sum, item) => sum + Number(item.unit_price_minor) * Number(item.quantity), 0);
    const categorySubtotals = discountCategorySubtotals(cart.items.map(item => {
      const variant = item.variant as unknown as { product?: { category_code?: string; category?: string } } | null;
      return { itemType: item.item_type, category: variant?.product?.category_code || variant?.product?.category, unitPriceMinor: Number(item.unit_price_minor), quantity: Number(item.quantity) };
    }));
    const { data, error } = await admin.rpc("validate_commerce_discount_scoped", {
      p_user_id: user.id,
      p_code: code,
      p_items_subtotal_minor: subtotalMinor,
      p_design_subtotal_minor: designSubtotalMinor,
      p_category_subtotals: categorySubtotals,
    });
    if (error || !data) throw error || new Error("discount:invalid");
    return apiOk(data as ValidatedDiscount);
  } catch (error) {
    const reason = discountReasonFromError(error);
    return apiError(discountErrorMessage(reason), 422, { reason });
  }
}

export const dynamic = "force-dynamic";
