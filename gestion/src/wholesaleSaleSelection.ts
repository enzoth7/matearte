import { canonicalCategoryCode, catalogValueLabel, defaultCatalogTaxonomy } from "../../shared/catalog-taxonomy";
import type { WholesaleProduct } from "./wholesaleSource";

export type WholesaleSaleCategory = "mates" | "materas" | "bombillas" | "bombillones";

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
const attribute = (product: WholesaleProduct, key: string) => {
  const value = product.catalog_attributes?.[key];
  return typeof value === "string" ? value.trim() : "";
};

export function wholesaleSaleCategory(product: WholesaleProduct): WholesaleSaleCategory | null {
  const raw = normalized(product.category_code || "");
  const category = canonicalCategoryCode(raw);
  const model = normalized(product.model);
  const bombillaType = normalized(attribute(product, "tipo-bombilla"));
  if (bombillaType === "apaga" || model === "apaga") return null;
  if (category === "mates" || category === "materas") return category;
  if (category === "bombillas") return raw === "bombillones" || bombillaType === "bombillon" || /\bbombillon\b/.test(model) ? "bombillones" : "bombillas";
  if (raw) return null;
  if (/\bmatera\b/.test(model)) return "materas";
  if (/\bbombillon\b/.test(model)) return "bombillones";
  if (/\bbombilla\b/.test(model)) return "bombillas";
  return /\b(mate|imperial|camionero|criollo|torpedo)\b/.test(model) ? "mates" : null;
}

export function wholesaleSaleType(product: WholesaleProduct): string {
  const category = wholesaleSaleCategory(product);
  const model = normalized(product.model);
  if (category === "mates") {
    const code = attribute(product, "tipo-mate") || model.match(/\b(imperial|camionero|criollo|torpedo)\b/)?.[1];
    return code ? catalogValueLabel(defaultCatalogTaxonomy, "tipo-mate", code) : product.model.trim();
  }
  if (category === "materas") {
    const code = attribute(product, "forma") || model.match(/\b(ovalada|cuadrada)\b/)?.[1];
    return code ? catalogValueLabel(defaultCatalogTaxonomy, "forma", code) : product.model.trim();
  }
  if (category === "bombillones") return "Bombillón";
  if (category === "bombillas") {
    const code = attribute(product, "tipo-bombilla");
    if (code) return catalogValueLabel(defaultCatalogTaxonomy, "tipo-bombilla", code);
    return "Bombilla";
  }
  return "";
}

/** Variante de pedido para ventas mayoristas "entreveradas": no es un SKU, no existe como producto. */
export const GENERIC_WHOLESALE_VARIANT = "Genérico";

/** Un representante por nombre de producto que tiene 2 o más variantes (colores) a elegir. */
export function genericVariantRepresentatives(products: WholesaleProduct[]): WholesaleProduct[] {
  const byModel = new Map<string, WholesaleProduct[]>();
  for (const product of products) byModel.set(product.model, [...(byModel.get(product.model) ?? []), product]);
  return [...byModel.values()].filter((group) => group.length > 1).map((group) => group[0]);
}

/** El precio de una línea genérica solo es válido si todos los colores del producto cuestan lo mismo. */
export const genericVariantPriceConflict = (siblings: Pick<WholesaleProduct, "price_arg">[]) =>
  new Set(siblings.map((product) => Number(product.price_arg) || 0)).size > 1;

export const wholesaleSaleVariantLabel = (product: WholesaleProduct) => [product.model.trim(), product.variant.trim()].filter(Boolean).join(" · ");

export const wholesaleSaleCategoryLabel = (category: WholesaleSaleCategory) => ({
  mates: "Mates", materas: "Materas", bombillas: "Bombillas", bombillones: "Bombillones",
}[category]);
