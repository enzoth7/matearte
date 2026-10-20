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
    return product.model.trim();
  }
  return "";
}

export const wholesaleSaleVariantLabel = (product: WholesaleProduct) => [product.model.trim(), product.variant.trim()].filter(Boolean).join(" · ");

export const wholesaleSaleCategoryLabel = (category: WholesaleSaleCategory) => ({
  mates: "Mates", materas: "Materas", bombillas: "Bombillas", bombillones: "Bombillones",
}[category]);
