import { apiError, apiOk } from "@/lib/api";
import { createPublicSupabase } from "@/lib/supabase/server";

import { quickAddSelection } from "@/lib/cart-recommendations";
import { catalogPurchaseAxes, normalizeCatalogValueMap } from "../../../../../../shared/catalog-taxonomy";
import { loadPublicCatalogTaxonomy } from "@/lib/catalog-taxonomy-live";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") || "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return apiError("Producto inválido.");
  const admin = createPublicSupabase();
  const [{ data: settings }, { data: product, error }] = await Promise.all([
    admin.from("commerce_settings").select("commerce_enabled").eq("singleton", true).single(),
    admin.from("commerce_products").select("id,editorial_slug,name,category,category_code,attributes,sale_mode,published,variants:commerce_variants(id,sku,name,base_price_minor,price_minor,currency,weight_grams,active,available_web,color,option_values)").eq("editorial_slug", slug).eq("published", true).maybeSingle(),
  ]);
  if (error || !product) return apiOk({ available: false, commerceEnabled: Boolean(settings?.commerce_enabled), product: null });
  const variants = (product.variants || [])
    .filter((variant) => variant.active && variant.available_web !== false && variant.price_minor > 0)
    .sort((left, right) => left.price_minor - right.price_minor || left.name.localeCompare(right.name));
  const taxonomy = await loadPublicCatalogTaxonomy(admin);
  const attributes = normalizeCatalogValueMap(product.attributes);
  const quickAdd = quickAddSelection({ category: product.category_code || product.category, attributes, saleMode: product.sale_mode,
    purchaseAxes: catalogPurchaseAxes(taxonomy, product.category_code || product.category, attributes, product.name),
    variants: variants.map(v => ({ id: v.id, commerceId: v.id, label: v.name, value: v.sku, available: true, price: { amountMinor: v.price_minor, currency: v.currency }, color: v.color, options: normalizeCatalogValueMap(v.option_values) })),
  });
  return apiOk({ quickAddVariantId: quickAdd?.variantId, quickAddOptionValues: quickAdd?.optionValues, available: variants.length > 0, commerceEnabled: Boolean(settings?.commerce_enabled), product: { ...product, variants } });
}
