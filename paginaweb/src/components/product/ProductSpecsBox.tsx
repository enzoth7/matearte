"use client";

import { useLocale } from "next-intl";
import type { Product, ProductVariant } from "@/types/catalog";
import { catalogAttributeDetails, catalogValueLabel, defaultCatalogTaxonomy, type CatalogAttributeDetail, type CatalogValueMap } from "../../../../shared/catalog-taxonomy";

type Locale = "es" | "en" | "pt";

export interface ProductSpecsBoxProps {
  product: Product;
  selectedOptions?: CatalogValueMap;
  activeVariant?: ProductVariant;
}

const titles: Record<Locale, string> = { es: "Características", en: "Specifications", pt: "Características" };
const labels: Record<string, Partial<Record<Locale, string>>> = {
  material: { es: "Material", en: "Material", pt: "Material" },
  forma: { en: "Shape", pt: "Forma" },
  "tipo-mate": { en: "Mate style", pt: "Modelo de cuia" },
  "material-mate": { en: "Mate material", pt: "Material da cuia" },
  "tipo-virola": { en: "Rim type", pt: "Tipo de virola" },
  "tipo-cuero": { en: "Leather type", pt: "Tipo de couro" },
  "diseno-fleje": { en: "Rim design", pt: "Desenho da faixa" },
  "tipo-bombilla": { en: "Straw type", pt: "Tipo de bomba" },
  "material-cuerpo": { en: "Body material", pt: "Material do corpo" },
  "material-pico": { en: "Tip material", pt: "Material do bico" },
  "forma-pico": { en: "Tip shape", pt: "Formato do bico" },
  "tamano": { en: "Size", pt: "Tamanho" },
  "interior": { en: "Interior", pt: "Interior" },
  "talle": { es: "Talle", en: "Boot size", pt: "Número da bota" },
  "largo-mm": { en: "Length", pt: "Comprimento" },
  "largo-cinto-cm": { en: "Belt length", pt: "Comprimento do cinto" },
  "capacidad-ml": { en: "Capacity", pt: "Capacidade" },
  "genero": { en: "Gender", pt: "Gênero" },
  color: { en: "Color", pt: "Cor" },
};
const sizeNames: Record<string, Record<Locale, string>> = {
  Cuero: { es: "Cuero", en: "Leather", pt: "Couro" },
  Ovalada: { es: "Ovalada", en: "Oval", pt: "Ovalada" },
  Cuadrada: { es: "Cuadrada", en: "Square", pt: "Quadrada" },
  Hombre: { es: "Hombre", en: "Men", pt: "Masculino" },
  Mujer: { es: "Mujer", en: "Women", pt: "Feminino" },
  Unisex: { es: "Unisex", en: "Unisex", pt: "Unissex" },
  Chico: { es: "Chico", en: "Small", pt: "Pequeno" },
  Mediano: { es: "Mediano", en: "Medium", pt: "Médio" },
  Grande: { es: "Grande", en: "Large", pt: "Grande" },
  Calabaza: { es: "Calabaza", en: "Gourd", pt: "Cabaça" },
  "Cerámica": { es: "Cerámica", en: "Ceramic", pt: "Cerâmica" },
  "Larga (19 cm)": { es: "Larga (19 cm)", en: "Long (19 cm)", pt: "Longa (19 cm)" },
  "Corta (16 cm)": { es: "Corta (16 cm)", en: "Short (16 cm)", pt: "Curta (16 cm)" },
};

function displayValue(detail: CatalogAttributeDetail, locale: Locale) {
  return detail.values.map(value => sizeNames[value]?.[locale] ?? value).join(", ");
}

export function ProductSpecsBox({ product, selectedOptions, activeVariant }: ProductSpecsBoxProps) {
  const rawLocale = useLocale();
  const locale: Locale = rawLocale === "en" || rawLocale === "pt" ? rawLocale : "es";
  const details = [...(product.attributeDetails ?? catalogAttributeDetails(defaultCatalogTaxonomy, product.attributes ?? {}))];
  const extraAttributes: CatalogValueMap = {};
  if (!details.some(detail => detail.code === "material")) {
    const material = product.materials?.[0] ?? product.filterData?.materials?.[0];
    if (material) extraAttributes.material = material;
  }
  if (product.category === "mates" && !details.some(detail => detail.code === "tipo-mate")) {
    const mateType = product.filterData?.mateType ?? product.filterData?.productTypes?.[0];
    if (mateType) extraAttributes["tipo-mate"] = mateType;
  }
  for (const code of ["tamano", "talle"] as const) {
    if (selectedOptions?.[code] && !details.some(detail => detail.code === code)) extraAttributes[code] = selectedOptions[code];
  }
  details.push(...catalogAttributeDetails(defaultCatalogTaxonomy, extraAttributes));
  const visibleDetails = details.filter(detail => detail.code !== "color" && detail.values.length > 0);
  const selectedColor = selectedOptions?.color ?? activeVariant?.options?.color ?? activeVariant?.color;
  const allColors = [...new Set(product.variants.map(variant => variant.options?.color ?? variant.color).filter((value): value is string => typeof value === "string" && Boolean(value)))];
  const colorValues = selectedColor ? [String(selectedColor)] : allColors;
  const colorText = colorValues.map(value => catalogValueLabel(defaultCatalogTaxonomy, "color", value)).join(", ");
  if (!visibleDetails.length && !colorText) return null;

  return (
    <div className="product-specs-card">
      <h3 className="product-specs-title">{titles[locale]}</h3>
      <ul className="product-specs-list">
        {visibleDetails.map(detail => (
          <li key={detail.code} className="product-specs-item">
            <strong className="product-specs-label">{labels[detail.code]?.[locale] ?? detail.label}:</strong>{" "}
            <span className="product-specs-value">{displayValue(detail, locale)}</span>
          </li>
        ))}
        {colorText && <li className="product-specs-item">
          <strong className="product-specs-label">{labels.color[locale] ?? "Color"}:</strong>{" "}
          <span className="product-specs-value">{colorText}</span>
        </li>}
      </ul>
    </div>
  );
}
