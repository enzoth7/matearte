"use client";

import {
  categoryOptions,
  colorOptions,
  materialOptions,
  productTypeOptions,
  priceRangeOptions,
  getProductColors,
  type CatalogFilters,
  type PriceRangeId,
} from "@/lib/catalog-filters";
import { useLocale, useTranslations } from "next-intl";
import type { CatalogColorId, CatalogMaterialId, CatalogProductTypeId, Product } from "@/types/catalog";

const COLOR_FALLBACKS: Record<string, Record<string, string>> = {
  es: {
    brown: "Marrón",
    marron: "Marrón",
    black: "Negro",
    negro: "Negro",
    natural: "Natural",
    rawLeather: "Cuero crudo",
    "cuero-crudo": "Cuero crudo",
    red: "Rojo",
    rojo: "Rojo",
    white: "Blanco",
    blanco: "Blanco",
    pink: "Rosado",
    rosado: "Rosado",
    gray: "Gris",
    gris: "Gris",
    gold: "Dorado",
    dorado: "Dorado",
    skyBlue: "Celeste",
    celeste: "Celeste",
    blue: "Azul",
    azul: "Azul",
    beige: "Beige",
  },
  en: {
    brown: "Brown",
    marron: "Brown",
    black: "Black",
    negro: "Black",
    natural: "Natural",
    rawLeather: "Raw leather",
    "cuero-crudo": "Raw leather",
    red: "Red",
    rojo: "Red",
    white: "White",
    blanco: "White",
    pink: "Pink",
    rosado: "Pink",
    gray: "Gray",
    gris: "Gray",
    gold: "Gold",
    dorado: "Gold",
    skyBlue: "Light blue",
    celeste: "Light blue",
    blue: "Blue",
    azul: "Blue",
    beige: "Beige",
  },
  pt: {
    brown: "Marrom",
    marron: "Marrom",
    black: "Preto",
    negro: "Preto",
    natural: "Natural",
    rawLeather: "Couro cru",
    "cuero-crudo": "Couro cru",
    red: "Vermelho",
    rojo: "Vermelho",
    white: "Branco",
    blanco: "Branco",
    pink: "Rosa",
    rosado: "Rosa",
    gray: "Cinza",
    gris: "Cinza",
    gold: "Dourado",
    dorado: "Dourado",
    skyBlue: "Azul celeste",
    celeste: "Azul celeste",
    blue: "Azul",
    azul: "Azul",
    beige: "Bege",
  },
};

type Props = {
  variant: "desktop" | "mobile";
  idPrefix: string;
  products: Product[];
  filters: CatalogFilters;
  onCategoryChange: (value: CatalogFilters["category"]) => void;
  onPriceToggle: (value: PriceRangeId) => void;
  onMaterialToggle: (value: CatalogMaterialId) => void;
  onProductTypeToggle: (value: CatalogProductTypeId) => void;
  onColorToggle: (value: CatalogColorId) => void;
  onClear: () => void;
};

export function CatalogFilterControls({
  variant,
  idPrefix,
  products,
  filters,
  onCategoryChange,
  onPriceToggle,
  onMaterialToggle,
  onProductTypeToggle,
  onColorToggle,
  onClear,
}: Props) {
  const t = useTranslations("catalog");
  const locale = useLocale();

  const getColorLabel = (labelKey: string, value: string) => {
    let rawLabel = "";
    try {
      rawLabel = t(labelKey as any);
    } catch {
      rawLabel = "";
    }
    if (!rawLabel || rawLabel.startsWith("catalog.")) {
      const cleanKey = rawLabel?.startsWith("catalog.") ? rawLabel.replace(/^catalog\./, "") : labelKey;
      const dict = COLOR_FALLBACKS[locale] || COLOR_FALLBACKS.es;
      return (
        dict[cleanKey] ||
        dict[labelKey] ||
        dict[value] ||
        COLOR_FALLBACKS.es[cleanKey] ||
        COLOR_FALLBACKS.es[labelKey] ||
        COLOR_FALLBACKS.es[value] ||
        value
      );
    }
    return rawLabel;
  };
  const mobile = variant === "mobile";
  const groupClass = mobile ? "catalog-mobile-filter-group" : "catalog-filter-group";
  const listClass = mobile ? "catalog-mobile-filter-list" : "catalog-filter-list";
  const rowClass = mobile ? "catalog-mobile-filter-row" : "catalog-check-row";
  const availableColors = new Set(products.flatMap((product) => getProductColors(product)));

  return (
    <div className={mobile ? "catalog-mobile-filter-groups" : "catalog-filter-groups"}>
      <fieldset className={`${groupClass} catalog-category-filter`}>
        <legend>{t("categories")}</legend>
        <div className={listClass}>
          {categoryOptions.map((option) => (
            <label key={option.value} className={rowClass}>
              <input
                type="radio"
                name={`${idPrefix}-category`}
                value={option.value}
                checked={filters.category === option.value}
                onChange={() => onCategoryChange(option.value as CatalogFilters["category"])}
              />
              <span className={mobile ? "catalog-mobile-checkbox" : "catalog-checkbox"} aria-hidden="true" />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={`${groupClass} catalog-price-filter`}>
        <legend>{t("price")}</legend>
        <div className={listClass}>
          {priceRangeOptions.map((option) => (
            <label key={option.value} className={rowClass}>
              <input type="checkbox" checked={filters.prices.includes(option.value)} onChange={() => onPriceToggle(option.value)} />
              <span className={mobile ? "catalog-mobile-checkbox" : "catalog-checkbox"} aria-hidden="true" />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={`${groupClass} catalog-material-filter`}>
        <legend>{t("material")}</legend>
        <div className={listClass}>
          {materialOptions.map((option) => (
            <label key={option.value} className={rowClass}>
              <input type="checkbox" checked={filters.materials.includes(option.value)} onChange={() => onMaterialToggle(option.value)} />
              <span className={mobile ? "catalog-mobile-checkbox" : "catalog-checkbox"} aria-hidden="true" />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={`${groupClass} catalog-product-type-filter`}>
        <legend>{t("productType")}</legend>
        <div className={listClass}>
          {productTypeOptions.map((option) => (
            <label key={option.value} className={rowClass}>
              <input type="checkbox" checked={filters.productTypes.includes(option.value)} onChange={() => onProductTypeToggle(option.value)} />
              <span className={mobile ? "catalog-mobile-checkbox" : "catalog-checkbox"} aria-hidden="true" />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={`${groupClass} catalog-color-filter`} aria-describedby={availableColors.size === 0 ? `${idPrefix}-color-note` : undefined}>
        <legend>{t("color")}</legend>
        <div className={listClass}>
          {colorOptions.map((option) => {
            const available = availableColors.has(option.value);
            return (
              <label key={option.value} className={`${rowClass}${available ? "" : " is-disabled"}`}>
                <input type="checkbox" disabled={!available} checked={filters.colors.includes(option.value)} onChange={() => onColorToggle(option.value)} />
                <span className={mobile ? "catalog-mobile-checkbox" : "catalog-checkbox"} aria-hidden="true" />
                <span className="catalog-color-swatch" style={{ backgroundColor: option.color }} aria-hidden="true" />
                <span>{getColorLabel(option.labelKey, option.value)}</span>
              </label>
            );
          })}
        </div>
        {availableColors.size === 0 && <p id={`${idPrefix}-color-note`} className="catalog-filter-note">{t("comingSoon")}</p>}
      </fieldset>
    </div>
  );
}
