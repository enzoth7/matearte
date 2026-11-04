import { apiError, apiOk, readJson } from "@/lib/api";
import { addCatalogItem, readCart, readPricedCart } from "@/lib/cart";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";

export async function GET() {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);
  try {
    const cart = await readPricedCart(client, user.id);
    const admin = createAdminSupabase();
    const [{ data: bank, error }, { data: discountSettings, error: discountError }] = await Promise.all([
      admin.from("commerce_bank_transfer_settings")
        .select("account_holder,transfer_account,cash_deposit_account,cash_deposit_label")
        .eq("singleton", true).single(),
      admin.from("commerce_settings")
        .select("uruguay_transfer_discount_enabled,uruguay_transfer_discount_categories,uruguay_transfer_discount_designs")
        .eq("singleton", true).single(),
    ]);
    if (discountError || !discountSettings) throw new Error("No se pudo cargar la configuración de descuentos.");
    const transferDiscount = { enabled: discountSettings.uruguay_transfer_discount_enabled,
      categories: discountSettings.uruguay_transfer_discount_categories, designs: discountSettings.uruguay_transfer_discount_designs };
    if (error || !bank) {
      if (cart.wholesale.eligible) throw new Error("La transferencia bancaria todavía no está configurada.");
      return apiOk({ ...cart, uruguay_transfer_discount: transferDiscount });
    }
    return apiOk({ ...cart, bank_transfer: bank, uruguay_transfer_discount: transferDiscount });
  }
  catch (error) { return apiError(error instanceof Error ? error.message : "No se pudo leer el carrito.", 500); }
}

export async function POST(request: Request) {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);
  try {
    const body = await readJson(request);
    const mergeKey = typeof body.mergeKey === "string" ? body.mergeKey : "";
    const items = Array.isArray(body.items) ? body.items : [];
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(mergeKey)) return apiError("Identificador de fusión inválido.");
    const admin = client;
    const cart = await readCart(admin, user.id);
    if (cart.merge_keys.includes(mergeKey)) return apiOk(await readPricedCart(admin, user.id));
    for (const raw of items.slice(0, 50)) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      if (typeof item.variantId !== "string") continue;
      const quantity = Math.max(1, Math.min(99, Number(item.quantity) || 1));
      const optionValues = item.optionValues && typeof item.optionValues === "object" && !Array.isArray(item.optionValues)
        ? item.optionValues as Record<string, string | number | boolean>
        : undefined;
      await addCatalogItem(admin, user.id, item.variantId, quantity, optionValues);
    }
    const mergeKeys = [...cart.merge_keys, mergeKey].slice(-50);
    await admin.from("carts").update({ merge_keys: mergeKeys }).eq("id", cart.id);
    return apiOk(await readPricedCart(admin, user.id));
  } catch (error) { return apiError(error instanceof Error ? error.message : "No se pudo fusionar el carrito.", 400); }
}

export const dynamic = "force-dynamic";
