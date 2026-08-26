import { apiError, apiOk, readJson } from "@/lib/api";
import { addCatalogItem, readCart, readPricedCart } from "@/lib/cart";
import { requireUser } from "@/lib/supabase/server";

export async function GET() {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);
  try { return apiOk(await readPricedCart(client, user.id)); }
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
      await addCatalogItem(admin, user.id, item.variantId, quantity);
    }
    const mergeKeys = [...cart.merge_keys, mergeKey].slice(-50);
    await admin.from("carts").update({ merge_keys: mergeKeys }).eq("id", cart.id);
    return apiOk(await readPricedCart(admin, user.id));
  } catch (error) { return apiError(error instanceof Error ? error.message : "No se pudo fusionar el carrito.", 400); }
}

export const dynamic = "force-dynamic";
