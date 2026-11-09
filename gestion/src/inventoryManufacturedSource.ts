import { commerceSource } from "./commerceSource";
import { readInventoryCosts, type CostArticle, type CostCategory } from "./inventoryCostSource";
import type { CostLine, CostProfile } from "./inventoryCostModel";

const client = () => {
  if (!commerceSource) throw new Error("La conexión de Gestión no está disponible.");
  return commerceSource;
};

export type ManufacturedProduct = {
  id: string;
  source_key: string | null;
  name: string;
  category_code: string;
  catalog_product_id: string | null;
  reference_sale_price_minor: number | null;
  reference_variable_cost_minor: number | null;
  source_row: string | null;
};

export type ManufacturedSupply = { product_id: string; cost_line_id: string; quantity: number };

export type ManufacturedData = {
  products: ManufacturedProduct[];
  supplies: ManufacturedSupply[];
  lines: CostLine[];
  profiles: CostProfile[];
  categories: CostCategory[];
  articles: CostArticle[];
};

export async function readManufacturedProducts(): Promise<ManufacturedData> {
  const [costs, products, supplies] = await Promise.all([
    readInventoryCosts(),
    client().from("inventory_manufactured_products")
      .select("id,source_key,name,category_code,catalog_product_id,reference_sale_price_minor,reference_variable_cost_minor,source_row")
      .order("source_key"),
    client().from("inventory_manufactured_supplies")
      .select("product_id,cost_line_id,quantity"),
  ]);
  if (products.error || supplies.error) throw products.error || supplies.error;
  const orderedProducts = ((products.data || []) as ManufacturedProduct[]).sort((a, b) => {
    const rowNumber = (product: ManufacturedProduct) => Number(product.source_key?.match(/:B(\d+)$/)?.[1] || 0);
    return (rowNumber(a) || Number.MAX_SAFE_INTEGER) - (rowNumber(b) || Number.MAX_SAFE_INTEGER)
      || a.name.localeCompare(b.name, "es");
  });
  return { ...costs, products: orderedProducts, supplies: (supplies.data || []) as ManufacturedSupply[] };
}

export async function saveManufacturedProduct(product: ManufacturedProduct, selections: ManufacturedSupply[]): Promise<void> {
  const { error: productError } = await client().from("inventory_manufactured_products").upsert({
    id: product.id,
    source_key: product.source_key,
    name: product.name.trim(),
    category_code: product.category_code,
    catalog_product_id: product.catalog_product_id,
    reference_sale_price_minor: product.reference_sale_price_minor,
    reference_variable_cost_minor: product.reference_variable_cost_minor,
    source_row: product.source_row,
    updated_at: new Date().toISOString(),
  });
  if (productError) throw productError;
  if (selections.length) {
    const { error } = await client().from("inventory_manufactured_supplies").upsert(
      selections.map((selection) => ({ product_id: product.id, cost_line_id: selection.cost_line_id, quantity: selection.quantity })),
      { onConflict: "product_id,cost_line_id" },
    );
    if (error) throw error;
  }
  const selectedIds = selections.map((selection) => selection.cost_line_id);
  const { data: existing, error: existingError } = await client().from("inventory_manufactured_supplies")
    .select("cost_line_id").eq("product_id", product.id);
  if (existingError) throw existingError;
  const removed = (existing || []).map((row: { cost_line_id: string }) => row.cost_line_id).filter((id: string) => !selectedIds.includes(id));
  if (removed.length) {
    const { error } = await client().from("inventory_manufactured_supplies")
      .delete().eq("product_id", product.id).in("cost_line_id", removed);
    if (error) throw error;
  }
}
