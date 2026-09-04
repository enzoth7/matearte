import { apiError, apiOk } from "@/lib/api";
import { createPublicSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") || "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return apiError("Producto inválido.");
  const admin = createPublicSupabase();
  const [{ data: settings }, { data: product, error }] = await Promise.all([
    admin.from("commerce_settings").select("commerce_enabled").eq("singleton", true).single(),
    admin.from("commerce_products").select("id,editorial_slug,name,sale_mode,published,variants:commerce_variants(id,sku,name,price_minor,currency,weight_grams,inventory_tracked,stock_on_hand,stock_reserved,active)").eq("editorial_slug", slug).eq("published", true).maybeSingle(),
  ]);
  if (error || !product) return apiOk({ available: false, commerceEnabled: Boolean(settings?.commerce_enabled), product: null });
  const variants = (product.variants || [])
    .filter((variant) => variant.active && variant.price_minor > 0 && (!variant.inventory_tracked || variant.stock_on_hand - variant.stock_reserved > 0))
    .sort((left, right) => left.price_minor - right.price_minor || left.name.localeCompare(right.name));
  return apiOk({ available: variants.length > 0, commerceEnabled: Boolean(settings?.commerce_enabled), product: { ...product, variants } });
}
