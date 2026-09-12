import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateDesignPriceMinor } from "@/lib/design-pricing";
import { normalizeCatalogValueMap, optionSignature, type CatalogValueMap } from "../../../shared/catalog-taxonomy";

export async function getOrCreateCart(client: SupabaseClient, userId: string) {
  const existing = await client.from("carts").select("id,user_id,status,merge_keys,updated_at").eq("user_id", userId).eq("status", "active").maybeSingle();
  if (existing.data) return existing.data;
  const created = await client.from("carts").insert({ user_id: userId }).select("id,user_id,status,merge_keys,updated_at").single();
  if (created.error) {
    const raced = await client.from("carts").select("id,user_id,status,merge_keys,updated_at").eq("user_id", userId).eq("status", "active").single();
    if (raced.error) throw raced.error;
    return raced.data;
  }
  return created.data;
}

export async function readCart(client: SupabaseClient, userId: string) {
  const cart = await getOrCreateCart(client, userId);
  const { data: items, error } = await client.from("cart_items").select(`
    id,item_type,variant_id,design_id,quantity,option_values_override,updated_at,
    variant:commerce_variants(id,sku,name,price_minor,currency,active,option_values,product:commerce_products(id,editorial_slug,name,category,category_code,sale_mode,published,commerce_product_images(storage_path,sort_order,variant_id,option_values))),
    design:designs(id,title,preview_path,updated_at)
  `).eq("cart_id", cart.id).order("created_at");
  if (error) throw error;
  return { ...cart, items: items || [] };
}

export async function readPricedCart(client: SupabaseClient, userId: string) {
  const cart = await readCart(client, userId);
  const designIds = cart.items
    .filter((item) => item.item_type === "design" && item.design_id)
    .map((item) => String(item.design_id));
  const designPrices = new Map<string, number>();

  if (designIds.length) {
    const [{ data: designs, error: designsError }, { data: catalog, error: catalogError }] = await Promise.all([
      client.from("designs").select("id,configuration,fleje_configuration").in("id", designIds).eq("user_id", userId),
      client.rpc("get_published_pricing_catalog"),
    ]);
    if (designsError) throw designsError;
    if (catalogError) throw catalogError;
    if (!catalog || typeof catalog !== "object") throw new Error("No existe un catálogo de precios publicado.");
    for (const design of designs || []) {
      const priced = calculateDesignPriceMinor(design.configuration, design.fleje_configuration, catalog as { versionId: string; version: number; rules: Record<string, number> });
      designPrices.set(String(design.id), priced.priceMinor);
    }
    if (designPrices.size !== new Set(designIds).size) throw new Error("No se pudo verificar el precio de uno de los diseños.");
  }

  return {
    ...cart,
    items: cart.items.map((item) => {
      const variant = item.variant as unknown as { price_minor?: number; currency?: string } | null;
      const unitPriceMinor = item.item_type === "design"
        ? designPrices.get(String(item.design_id))
        : Number(variant?.price_minor || 0);
      if (!Number.isFinite(unitPriceMinor)) throw new Error("No se pudo verificar el precio de uno de los artículos.");
      return { ...item, unit_price_minor: unitPriceMinor as number, currency: variant?.currency || "UYU" };
    }),
  };
}

async function validatedCatalogSelection(client: SupabaseClient, variantOptionsValue: unknown, selectionValue: unknown): Promise<CatalogValueMap> {
  const variantOptions = normalizeCatalogValueMap(variantOptionsValue);
  const selection = normalizeCatalogValueMap(selectionValue);
  const genericSelections: Array<[string,string]> = [];
  for (const [attribute, value] of Object.entries(selection)) {
    if (!(attribute in variantOptions)) throw new Error("La selección contiene una opción que no pertenece a la variante.");
    const variantValue = variantOptions[attribute];
    if (variantValue !== "todos" && value !== variantValue) throw new Error("La opción elegida no coincide con la variante disponible.");
    if (variantValue === "todos" && value === "todos") throw new Error("Elegí una opción concreta antes de agregar el producto.");
    if (variantValue === "todos") {
      if (typeof value !== "string") throw new Error("La opción elegida no es válida.");
      genericSelections.push([attribute,value]);
    }
  }
  if (genericSelections.length) {
    const {data,error} = await client.from("commerce_attribute_options")
      .select("attribute_code,code")
      .in("attribute_code", [...new Set(genericSelections.map(([attribute]) => attribute))])
      .eq("active", true);
    if (error) throw error;
    const allowed = new Set((data || []).map(option => `${option.attribute_code}:${option.code}`));
    if (genericSelections.some(([attribute,value]) => !allowed.has(`${attribute}:${value}`))) {
      throw new Error("La opción elegida ya no está disponible.");
    }
  }
  return { ...variantOptions, ...selection };
}

export async function addCatalogItem(client: SupabaseClient, userId: string, variantId: string, quantity: number, optionValuesOverride?: Record<string, string | number | boolean>) {
  const cart = await getOrCreateCart(client, userId);
  const { data: variant, error } = await client.from("commerce_variants").select("id,active,option_values,product:commerce_products!inner(published)").eq("id", variantId).single();
  if (error || !variant?.active || !(variant.product as unknown as { published: boolean }).published) throw new Error("La variante no está disponible.");
  const variantOptions = normalizeCatalogValueMap(variant.option_values);
  const selectedOptions = await validatedCatalogSelection(client, variantOptions, optionValuesOverride);
  const selectionSignature = optionSignature(selectedOptions);
  const current = await client.from("cart_items").select("id,quantity,option_values_override").eq("cart_id", cart.id).eq("variant_id", variantId);
  if (current.error) throw current.error;
  const currentItem = current.data?.find((item) => {
    const storedOptions = normalizeCatalogValueMap(item.option_values_override);
    return optionSignature(Object.keys(storedOptions).length ? storedOptions : variantOptions) === selectionSignature;
  });
  const next = Math.min(99, (currentItem?.quantity || 0) + quantity);
  if (currentItem) {
    const result = await client.from("cart_items").update({ quantity: next, option_values_override: selectedOptions }).eq("id", currentItem.id).select("id").single();
    if (result.error) throw result.error;
    return result.data;
  }
  const result = await client.from("cart_items").insert({ cart_id: cart.id, item_type: "catalog", variant_id: variantId, quantity, option_values_override: selectedOptions }).select("id").single();
  if (result.error) throw result.error;
  return result.data;
}

export async function addDesignItem(client: SupabaseClient, userId: string, designId: string) {
  const cart = await getOrCreateCart(client, userId);
  const design = await client.from("designs").select("id").eq("id", designId).eq("user_id", userId).maybeSingle();
  if (!design.data) throw new Error("El diseño no existe o no te pertenece.");
  const existing = await client.from("cart_items").select("id").eq("cart_id", cart.id).eq("design_id", designId).maybeSingle();
  if (existing.data) return existing.data;
  const result = await client.from("cart_items").insert({ cart_id: cart.id, item_type: "design", design_id: designId, quantity: 1 }).select("id").single();
  if (result.error) throw result.error;
  return result.data;
}
