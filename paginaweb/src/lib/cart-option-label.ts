import { catalogAttributeLabel, catalogValueLabel, defaultCatalogTaxonomy, normalizeCatalogValueMap, type CatalogValueMap } from "../../../shared/catalog-taxonomy";
import type { Locale } from "@/types/catalog";

const labels: Record<Locale, Record<string, string>> = {
  es: { color: "Color", talle: "Talle", tamano: "Tamaño", interior: "Interior", "largo-mm": "Largo" },
  en: { color: "Color", talle: "Size", tamano: "Size", interior: "Interior", "largo-mm": "Length" },
  pt: { color: "Cor", talle: "Tamanho", tamano: "Tamanho", interior: "Interior", "largo-mm": "Comprimento" },
};
const values: Partial<Record<Locale, Record<string, string>>> = {
  en: { negro: "Black", blanco: "White", marron: "Brown", natural: "Natural", chico: "Small", mediano: "Medium", grande: "Large", calabaza: "Gourd", ceramica: "Ceramic" },
  pt: { negro: "Preto", blanco: "Branco", marron: "Marrom", natural: "Natural", chico: "Pequeno", mediano: "Médio", grande: "Grande", calabaza: "Porongo", ceramica: "Cerâmica" },
};
export function cartOptionLabel(input: CatalogValueMap | undefined, locale: Locale): string {
  return Object.entries(normalizeCatalogValueMap(input))
    .filter(([,value]) => value !== "" && value !== "todos")
    .sort(([a],[b]) => a === "color" ? -1 : b === "color" ? 1 : a.localeCompare(b))
    .map(([code,value]) => {
      const label = labels[locale][code] ?? catalogAttributeLabel(defaultCatalogTaxonomy,code);
      const translated = values[locale]?.[String(value)];
      const colorParts = code === "color" ? String(value).split("-") : [];
      const color = colorParts.length && colorParts.every(part => values[locale]?.[part]) ? colorParts.map(part => values[locale]![part]).join("/") : undefined;
      return `${label}: ${translated ?? color ?? catalogValueLabel(defaultCatalogTaxonomy,code,value)}`;
    }).join(", ");
}
