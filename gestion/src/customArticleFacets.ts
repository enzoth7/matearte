import type { Product } from "./data";
import { catalogPurchaseAxes, catalogValueLabel, defaultCatalogTaxonomy, normalizeCatalogValueMap } from "../../shared/catalog-taxonomy";

export const UNSPECIFIED = "__unspecified";
const values = (raw: unknown): string[] => (Array.isArray(raw) ? raw : [raw]).filter(value => value !== undefined && value !== null && value !== "").map(String);
export const isMateArticle = (product: Product) => product.categoryCode === "mates" || product.personalizationType === "mate" || Boolean(product.attributes?.["tipo-mate"]);
export const customModelLabel = (product: Product) => {
  const code = product.categoryCode === "materas" ? "tipo-matera" : product.categoryCode?.startsWith("bombill") ? "tipo-bombilla" : "tipo-mate";
  const raw = product.attributes?.[code];
  if (typeof raw === "string") return catalogValueLabel(defaultCatalogTaxonomy, code, raw);
  return product.catalogType || product.name.match(/imperial|camionero|criollo|torpedo|ovalada|cuadrada|bombillón|bombilla/i)?.[0].toLocaleLowerCase() || "General";
};

export const customFacetCodes = ["interior", "material", "tipo-cuero", "color", "tipo-virola", "diseno-fleje", "posamate", "pie", "acabado", "tamano"];
export const customFacetLabels: Record<string, string> = { interior: "Material del interior", material: "Material exterior", "tipo-cuero": "Cuero o textura", color: "Color", "tipo-virola": "Tipo de virola", "diseno-fleje": "Diseño del fleje", posamate: "Posamate", pie: "Pie", acabado: "Terminación", tamano: "Tamaño" };

export function customFacetValues(product: Product, code: string): string[] {
  const attributes = normalizeCatalogValueMap(product.attributes);
  let result: string[] = [];
  if (isMateArticle(product) && (code === "interior" || code === "tamano")) {
    // "Cuero" describes the covering in the legacy catalog, never the interior.
    result = catalogPurchaseAxes(defaultCatalogTaxonomy, product.categoryCode || "mates", attributes, product.name).find(axis => axis.code === code)?.values.map(option => option.value) || [];
    if (!result.length && code === "interior" && !attributes.interior) result = values(attributes["material-mate"]).filter(value => value !== "cuero");
  } else if (code === "material") {
    result = values(product.options?.material || attributes.material);
    if (isMateArticle(product) && attributes["tipo-cuero"] === "sin-cuero") result = ["sin-revestimiento"];
    if (!result.length && isMateArticle(product)) {
      if (attributes["tipo-cuero"] === "sin-cuero") result = ["sin-revestimiento"];
      else if (attributes["material-mate"] === "cuero" || attributes["tipo-cuero"]) result = ["cuero"];
    }
  } else {
    result = values(product.options?.[code] || attributes[code]);
    if (!result.length) result = values(code === "color" ? product.variant.split(/\s*[·|]\s*/)[0] : code === "tipo-virola" ? product.rim : code === "tipo-cuero" ? product.leather : undefined);
  }
  return result.length ? [...new Set(result)] : [UNSPECIFIED];
}

export function customFacetLabel(code: string, value: string) {
  if (value === UNSPECIFIED) return "Sin especificar";
  if (value === "sin-revestimiento") return "Sin revestimiento";
  if (code === "tipo-virola" && value === "imperial") return "Imperial original";
  return catalogValueLabel(defaultCatalogTaxonomy, code, value);
}

export const matchingCustomProducts = (products: Product[], chosen: Record<string, string>) => products.filter(product => Object.entries(chosen).every(([code, value]) => !value || customFacetValues(product, code).includes(value)));

// Give the latest choice priority, keeping every earlier compatible choice.
export function changeCustomFacet(products: Product[], chosen: Record<string, string>, code: string, value: string) {
  const next: Record<string, string> = value ? { [code]: value } : {};
  for (const [key, selected] of Object.entries(chosen)) {
    if (key !== code && matchingCustomProducts(products, { ...next, [key]: selected }).length) next[key] = selected;
  }
  return next;
}
