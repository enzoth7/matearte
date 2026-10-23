import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogTaxonomy } from "../../../shared/catalog-taxonomy";

export async function loadPublicCatalogTaxonomy(client: SupabaseClient): Promise<CatalogTaxonomy> {
  const [categories, attributes, options, rules] = await Promise.all([
    client.from("commerce_categories").select("code,label_es,parent_code,active,sort_order").eq("active", true),
    client.from("commerce_attribute_definitions").select("code,label_es,data_type,unit,input_style,active,sort_order").eq("active", true),
    client.from("commerce_attribute_options").select("attribute_code,code,label_es,swatch_hex,active,sort_order").eq("active", true),
    client.from("commerce_category_attributes").select("category_code,attribute_code,scope,required,filterable,purchase_selectable,sort_order"),
  ]);
  const error = categories.error || attributes.error || options.error || rules.error;
  if (error) throw error;
  return {
    categories: (categories.data ?? []) as CatalogTaxonomy["categories"],
    attributes: (attributes.data ?? []) as CatalogTaxonomy["attributes"],
    options: (options.data ?? []) as CatalogTaxonomy["options"],
    rules: (rules.data ?? []) as CatalogTaxonomy["rules"],
  };
}
