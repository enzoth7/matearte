import { apiError, apiOk, readJson } from "@/lib/api";
import { readPricedCart, assertValidCartSelections, assertWebAvailableCart } from "@/lib/cart";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";
import { getArgentinaSettings, getArgentinaBasePricing } from "@/lib/argentina-server";
import { toArsMinor } from "@/lib/argentina";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET() {
  const settings = await getArgentinaSettings();
  return apiOk({
    enabled: Boolean(settings),
    arsPerUyu: settings ? Number(settings.ars_per_uyu) : null,
    bank: settings ? { bank_name: settings.bank_name, account_holder: settings.account_holder, cbu: settings.cbu, alias: settings.alias } : null,
  });
}

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);
  try {
    const key = request.headers.get("idempotency-key") || "";
    if (!uuid.test(key)) return apiError("Identificador de pedido inválido.");
    const admin = createAdminSupabase();
    const existing = await admin.from("orders").select("id,customer_snapshot").eq("user_id", user.id).eq("checkout_idempotency_key", key).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      if (existing.data.customer_snapshot?.purchaseFlow !== "argentina_retail_transfer") return apiError("Identificador de pedido inválido.");
      return apiOk({ orderId: existing.data.id });
    }
    const settings = await getArgentinaSettings();
    if (!settings) return apiError("Las compras para Argentina todavía no están habilitadas.", 503);
    const body = await readJson(request);
    const raw = body.customer && typeof body.customer === "object" ? body.customer as Record<string, unknown> : {};
    const customer: Record<string, string> = { countryCode: "AR", country: "Argentina", email: user.email || "" };
    for (const field of ["fullName", "phone", "department", "city", "postalCode", "address"]) {
      const value = typeof raw[field] === "string" ? raw[field].trim() : "";
      if (!value || value.length > (field === "address" ? 240 : 120)) return apiError("Completá los datos de entrega en Argentina.");
      customer[field] = value;
    }
    if (raw.countryCode !== "AR") return apiError("La transferencia en ARS requiere entrega en Argentina.");
    const cart = await readPricedCart(admin, user.id);
    assertWebAvailableCart(cart);
    await assertValidCartSelections(admin, cart);
    if (!cart.items.length) return apiError("El carrito está vacío.");
    if (cart.wholesale.eligible) return apiError("Este medio de pago es para compras por unidad. Tu carrito alcanza el mínimo mayorista.");
    const useBasePrice = await getArgentinaBasePricing();
    const total = cart.items.reduce((sum, item) => sum + toArsMinor(useBasePrice && item.item_type === "catalog" ? item.catalog_base_unit_price_minor : item.unit_price_minor, Number(settings.ars_per_uyu)) * item.quantity, 0);
    if (!Number.isSafeInteger(total) || total <= 0) return apiError("No se pudo calcular el total.");
    const designPrices = Object.fromEntries(cart.items.filter(item => item.item_type === "design").map(item => [item.design_id, item.unit_price_minor]));
    const result = await admin.rpc("create_argentina_retail_order", { p_user_id: user.id, p_cart_id: cart.id, p_customer: customer, p_design_prices: designPrices, p_idempotency_key: key });
    if (result.error) throw result.error;
    return apiOk({ orderId: result.data.id }, result.data.existing ? 200 : 201);
  } catch (error) { return apiError(error instanceof Error ? error.message : "No se pudo crear el pedido.", 400); }
}
export const dynamic = "force-dynamic";
