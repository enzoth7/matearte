"use client";

import { useLocale } from "next-intl";
import { specLabel, specValue } from "@/lib/product-spec-labels";
import type { Product, ProductVariant } from "@/types/catalog";
import { catalogAttributeDetails, catalogValueLabel, defaultCatalogTaxonomy, type CatalogAttributeDetail, type CatalogValueMap } from "../../../../shared/catalog-taxonomy";

type Locale = "es" | "en" | "pt";

export interface ProductSpecsBoxProps {
  product: Product;
  selectedOptions?: CatalogValueMap;
  activeVariant?: ProductVariant;
}

const titles: Record<Locale, string> = { es: "Características", en: "Specifications", pt: "Características" };

function displayValue(detail: CatalogAttributeDetail, locale: Locale) {
  return detail.values.map(value => specValue(value, locale)).join(", ");
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
            <strong className="product-specs-label">{specLabel(detail.code, detail.label, locale, product.category)}:</strong>{" "}
            <span className="product-specs-value">{displayValue(detail, locale)}</span>
          </li>
        ))}
        {colorText && <li className="product-specs-item">
          <strong className="product-specs-label">{specLabel("color", "Color", locale)}:</strong>{" "}
          <span className="product-specs-value">{colorText}</span>
        </li>}
      </ul>
    </div>
  );
}
