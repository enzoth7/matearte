import { apiError, apiOk, readJson } from "@/lib/api";
import { readPricedCart } from "@/lib/cart";
import { discountErrorMessage, discountReasonFromError, normalizeDiscountCode, type ValidatedDiscount } from "@/lib/discounts";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";

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
    const { data, error } = await admin.rpc("validate_commerce_discount", {
      p_user_id: user.id,
      p_code: code,
      p_subtotal_minor: subtotalMinor,
    });
    if (error || !data) throw error || new Error("discount:invalid");
    return apiOk(data as ValidatedDiscount);
  } catch (error) {
    const reason = discountReasonFromError(error);
    return apiError(discountErrorMessage(reason), 422, { reason });
  }
}

export const dynamic = "force-dynamic";
