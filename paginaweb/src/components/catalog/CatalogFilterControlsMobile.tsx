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
    brown: "Marrón", marron: "Marrón", black: "Negro", negro: "Negro",
    natural: "Natural", rawLeather: "Cuero crudo", "cuero-crudo": "Cuero crudo",
    red: "Rojo", rojo: "Rojo", white: "Blanco", blanco: "Blanco",
    pink: "Rosado", rosado: "Rosado", gray: "Gris", gris: "Gris",
    gold: "Dorado", dorado: "Dorado", skyBlue: "Celeste", celeste: "Celeste",
    blue: "Azul", azul: "Azul", beige: "Beige",
  },
  en: {
    brown: "Brown", marron: "Brown", black: "Black", negro: "Black",
    natural: "Natural", rawLeather: "Raw leather", "cuero-crudo": "Raw leather",
    red: "Red", rojo: "Red", white: "White", blanco: "White",
    pink: "Pink", rosado: "Pink", gray: "Gray", gris: "Gray",
    gold: "Gold", dorado: "Gold", skyBlue: "Light blue", celeste: "Light blue",
    blue: "Blue", azul: "Blue", beige: "Beige",
  },
  pt: {
    brown: "Marrom", marron: "Marrom", black: "Preto", negro: "Preto",
    natural: "Natural", rawLeather: "Couro cru", "cuero-crudo": "Couro cru",
    red: "Vermelho", rojo: "Vermelho", white: "Branco", blanco: "Branco",
    pink: "Rosa", rosado: "Rosa", gray: "Cinza", gris: "Cinza",
    gold: "Dourado", dorado: "Dourado", skyBlue: "Azul celeste", celeste: "Azul celeste",
    blue: "Azul", azul: "Azul", beige: "Bege",
  },
};

type Props = {
  products: Product[];
  filters: CatalogFilters;
  onCategoryChange: (value: CatalogFilters["category"]) => void;
  onPriceChange: (value: PriceRangeId | "") => void;
  onMaterialChange: (value: CatalogMaterialId | "") => void;
  onProductTypeChange: (value: CatalogProductTypeId | "") => void;
  onColorChange: (value: CatalogColorId | "") => void;
};

export function CatalogFilterControlsMobile({
  products,
  filters,
  onCategoryChange,
  onPriceChange,
  onMaterialChange,
  onProductTypeChange,
  onColorChange,
}: Props) {
  const t = useTranslations("catalog");
  const locale = useLocale();

  const getColorLabel = (labelKey: string, value: string) => {
    let rawLabel = "";
    try { rawLabel = t(labelKey as any); } catch { rawLabel = ""; }
    if (!rawLabel || rawLabel.startsWith("catalog.")) {
      const cleanKey = rawLabel?.startsWith("catalog.") ? rawLabel.replace(/^catalog\./, "") : labelKey;
      const dict = COLOR_FALLBACKS[locale] || COLOR_FALLBACKS.es;
      return (
        dict[cleanKey] || dict[labelKey] || dict[value] ||
        COLOR_FALLBACKS.es[cleanKey] || COLOR_FALLBACKS.es[labelKey] || COLOR_FALLBACKS.es[value] || value
      );
    }
    return rawLabel;
  };

  const availableColors = new Set(products.flatMap((product) => getProductColors(product)));

  const selectedPrice = filters.prices[0] ?? "";
  const selectedMaterial = filters.materials[0] ?? "";
  const selectedProductType = filters.productTypes[0] ?? "";
  const selectedColor = filters.colors[0] ?? "";

  // Strings "todos" hardcodeados para evitar problemas de caché de Turbopack con claves nuevas
  const allPricesLabel = (({ es: "Todos los precios", en: "All prices", pt: "Todos os preços" }) as Record<string, string>)[locale] ?? "Todos los precios";
  const allMaterialsLabel = (({ es: "Todos los materiales", en: "All materials", pt: "Todos os materiais" }) as Record<string, string>)[locale] ?? "Todos los materiales";
  const allTypesLabel = (({ es: "Todos los tipos", en: "All types", pt: "Todos os tipos" }) as Record<string, string>)[locale] ?? "Todos los tipos";
  const allColorsLabel = (({ es: "Todos los colores", en: "All colors", pt: "Todas as cores" }) as Record<string, string>)[locale] ?? "Todos los colores";

  return (
    <div className="catalog-mobile-filter-selects">
      <div className="catalog-mobile-filter-select-group">
        <label className="catalog-mobile-filter-select-label" htmlFor="mfs-category">
          {t("categories")}
        </label>
        <div className="catalog-mobile-filter-select-wrap">
          <select
            id="mfs-category"
            value={filters.category}
            onChange={(e) => onCategoryChange(e.target.value as CatalogFilters["category"])}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="catalog-mobile-filter-select-group">
        <label className="catalog-mobile-filter-select-label" htmlFor="mfs-price">
          {t("price")}
        </label>
        <div className="catalog-mobile-filter-select-wrap">
          <select
            id="mfs-price"
            value={selectedPrice}
            onChange={(e) => onPriceChange(e.target.value as PriceRangeId | "")}
          >
            <option value="">{allPricesLabel}</option>
            {priceRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="catalog-mobile-filter-select-group">
        <label className="catalog-mobile-filter-select-label" htmlFor="mfs-material">
          {t("material")}
        </label>
        <div className="catalog-mobile-filter-select-wrap">
          <select
            id="mfs-material"
            value={selectedMaterial}
            onChange={(e) => onMaterialChange(e.target.value as CatalogMaterialId | "")}
          >
            <option value="">{allMaterialsLabel}</option>
            {materialOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="catalog-mobile-filter-select-group">
        <label className="catalog-mobile-filter-select-label" htmlFor="mfs-type">
          {t("productType")}
        </label>
        <div className="catalog-mobile-filter-select-wrap">
          <select
            id="mfs-type"
            value={selectedProductType}
            onChange={(e) => onProductTypeChange(e.target.value as CatalogProductTypeId | "")}
          >
            <option value="">{allTypesLabel}</option>
            {productTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="catalog-mobile-filter-select-group">
        <label className="catalog-mobile-filter-select-label" htmlFor="mfs-color">
          {t("color")}
        </label>
        <div className="catalog-mobile-filter-select-wrap">
          <select
            id="mfs-color"
            value={selectedColor}
            onChange={(e) => onColorChange(e.target.value as CatalogColorId | "")}
          >
            <option value="">{allColorsLabel}</option>
            {colorOptions
              .filter((option) => availableColors.has(option.value))
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {getColorLabel(option.labelKey, option.value)}
                </option>
              ))}
          </select>
        </div>
      </div>
    </div>
  );
}
