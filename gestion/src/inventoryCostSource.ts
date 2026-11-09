import { commerceSource } from "./commerceSource";
import type { CostLine, CostProfile } from "./inventoryCostModel";

const client = () => {
  if (!commerceSource) throw new Error("La conexión de Gestión no está disponible.");
  return commerceSource;
};

export type CostCategory = { code: string; label_es: string; active: boolean };
export type CostArticle = { product_id: string; variant_id: string; product_name: string; variant_name: string; sku: string;
  category_code: string; base_price_minor: number | null; active: boolean };

async function readCostArticles(): Promise<CostArticle[]> {
  type ProductRow = { id: string; name: string; category_code: string | null; category: string | null; sale_mode: string | null;
    commerce_variants: { id: string; name: string; sku: string; base_price_minor: number | null; price_minor: number | null; active: boolean }[] };
  const products: ProductRow[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await client().from("commerce_products")
      .select("id,name,category_code,category,sale_mode,commerce_variants(id,name,sku,base_price_minor,price_minor,active)")
      .order("name").range(offset, offset + 199);
    if (error) throw error;
    const page = (data || []) as ProductRow[];
    products.push(...page);
    if (page.length < 200) break;
  }
  return products.filter((product) => product.sale_mode !== "service")
    .flatMap((product) => (product.commerce_variants || []).map((variant) => ({
      product_id: product.id, variant_id: variant.id, product_name: product.name, variant_name: variant.name,
      sku: variant.sku, category_code: product.category_code || product.category || "",
      base_price_minor: variant.base_price_minor ?? variant.price_minor ?? null, active: variant.active,
    })));
}

export async function readInventoryCosts(): Promise<{ profiles: CostProfile[]; lines: CostLine[]; categories: CostCategory[]; articles: CostArticle[] }> {
  const [profiles, lines, categories, articles] = await Promise.all([
    client().from("inventory_cost_profiles").select("id,category_code,name,method,benchmark_material_minor").order("category_code"),
    client().from("inventory_cost_lines").select("id,profile_id,name,group_name,kind,mode,amount_minor,currency,exchange_rate_to_uyu,purchase_quantity,consumption_quantity,unit,sort_order,catalog_variant_id").order("sort_order"),
    client().from("commerce_categories").select("code,label_es,active").order("sort_order"),
    readCostArticles(),
  ]);
  if (profiles.error || lines.error || categories.error) throw profiles.error || lines.error || categories.error;
  return { profiles: (profiles.data || []) as CostProfile[], lines: (lines.data || []) as CostLine[],
    categories: (categories.data || []) as CostCategory[], articles };
}

export async function ensureInventoryCostProfile(category: CostCategory, profiles: CostProfile[], method: CostProfile["method"] = "fabricacion"): Promise<string> {
  const existing = profiles.find((profile) => profile.category_code === category.code);
  if (existing) return existing.id;
  const { data, error } = await client().from("inventory_cost_profiles").upsert({
    category_code: category.code, name: category.label_es, method, benchmark_material_minor: null,
  }, { onConflict: "category_code", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) throw error;
  if (data?.id) return data.id;
  const found = await client().from("inventory_cost_profiles").select("id").eq("category_code", category.code).single();
  if (found.error || !found.data?.id) throw found.error || new Error("No se pudo crear la categoría de costos.");
  return found.data.id;
}

export async function saveInventoryCostLine(line: CostLine): Promise<void> {
  const { id, profile_id, name, group_name, kind, mode, amount_minor, currency, exchange_rate_to_uyu,
    purchase_quantity, consumption_quantity, unit, sort_order, catalog_variant_id } = line;
  const { error } = await client().from("inventory_cost_lines").upsert({ id, profile_id, name: name.trim(), group_name: group_name?.trim() || "Otros", kind, mode,
    amount_minor, currency, exchange_rate_to_uyu: currency === "UYU" ? null : exchange_rate_to_uyu,
    purchase_quantity: mode === "purchase_quantity" ? purchase_quantity : null,
    consumption_quantity: mode === "purchase_quantity" ? consumption_quantity : null,
    catalog_variant_id: kind === "purchase" ? catalog_variant_id || null : null,
    unit: mode === "purchase_quantity" ? unit?.trim() || null : null, sort_order });
  if (error) throw error;
}
