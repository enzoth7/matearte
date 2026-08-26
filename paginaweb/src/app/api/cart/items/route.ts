import { apiError, apiOk, readJson } from "@/lib/api";
import { addCatalogItem, addDesignItem, readCart, readPricedCart } from "@/lib/cart";
import { requireUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);
  try {
    const body = await readJson(request);
    const admin = client;
    if (body.itemType === "catalog" && typeof body.variantId === "string") await addCatalogItem(admin, user.id, body.variantId, Math.max(1, Math.min(99, Number(body.quantity) || 1)));
    else if (body.itemType === "design" && typeof body.designId === "string") await addDesignItem(admin, user.id, body.designId);
    else return apiError("Artículo inválido.");
    return apiOk(await readPricedCart(admin, user.id), 201);
  } catch (error) { return apiError(error instanceof Error ? error.message : "No se pudo agregar el artículo.", 400); }
}

export async function PATCH(request: Request) {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);
  try {
    const body = await readJson(request);
    if (typeof body.itemId !== "string") return apiError("Artículo inválido.");
    const quantity = Math.max(1, Math.min(99, Number(body.quantity) || 1));
    const admin = client;
    const cart = await readCart(admin, user.id);
    const item = cart.items.find((entry) => entry.id === body.itemId);
    if (!item) return apiError("El artículo no existe.", 404);
    if (item.item_type === "design" && quantity !== 1) return apiError("Un diseño personalizado tiene cantidad 1.");
    if (item.item_type === "catalog") {
      const variant = item.variant as unknown as { inventory_tracked: boolean; stock_on_hand: number; stock_reserved: number };
      if (variant.inventory_tracked && variant.stock_on_hand - variant.stock_reserved < quantity) return apiError("No hay stock suficiente.", 409);
    }
    const result = await admin.from("cart_items").update({ quantity }).eq("id", item.id).eq("cart_id", cart.id);
    if (result.error) throw result.error;
    return apiOk(await readPricedCart(admin, user.id));
  } catch (error) { return apiError(error instanceof Error ? error.message : "No se pudo actualizar el artículo.", 400); }
}

export async function DELETE(request: Request) {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);
  try {
    const body = await readJson(request);
    if (typeof body.itemId !== "string") return apiError("Artículo inválido.");
    const admin = client;
    const cart = await readCart(admin, user.id);
    const result = await admin.from("cart_items").delete().eq("id", body.itemId).eq("cart_id", cart.id);
    if (result.error) throw result.error;
    return apiOk(await readPricedCart(admin, user.id));
  } catch (error) { return apiError(error instanceof Error ? error.message : "No se pudo quitar el artículo.", 400); }
}

export const dynamic = "force-dynamic";
