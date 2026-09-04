"use client";

import {
  categoryOptions,
  colorOptions,
  finishOptions,
  materialOptions,
  productTypeOptions,
  priceRangeOptions,
  type CatalogFilters,
  type PriceRangeId,
} from "@/lib/catalog-filters";
import { useTranslations } from "next-intl";
import type { CatalogColorId, CatalogFinishId, CatalogMaterialId, CatalogProductTypeId, Product } from "@/types/catalog";

type Props = {
  variant: "desktop" | "mobile";
  idPrefix: string;
  products: Product[];
  filters: CatalogFilters;
  onCategoryChange: (value: CatalogFilters["category"]) => void;
  onPriceToggle: (value: PriceRangeId) => void;
  onMaterialToggle: (value: CatalogMaterialId) => void;
  onProductTypeToggle: (value: CatalogProductTypeId) => void;
  onFinishToggle: (value: CatalogFinishId) => void;
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
  onFinishToggle,
  onColorToggle,
  onClear,
}: Props) {
  const t = useTranslations("catalog");
  const mobile = variant === "mobile";
  const groupClass = mobile ? "catalog-mobile-filter-group" : "catalog-filter-group";
  const listClass = mobile ? "catalog-mobile-filter-list" : "catalog-filter-list";
  const rowClass = mobile ? "catalog-mobile-filter-row" : "catalog-check-row";
  const availableColors = new Set(products.flatMap((product) => product.filterData.colors ?? []));
  const hasActiveFilters = filters.category !== "todas" || filters.prices.length > 0 || filters.materials.length > 0 || filters.productTypes.length > 0 || filters.finishes.length > 0 || filters.colors.length > 0;

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
                onChange={() => onCategoryChange(option.value)}
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

      <fieldset className={`${groupClass} catalog-finish-filter`}>
        <legend>{t("finish")}</legend>
        <div className={listClass}>
          {finishOptions.map((option) => (
            <label key={option.value} className={rowClass}>
              <input type="checkbox" checked={filters.finishes.includes(option.value)} onChange={() => onFinishToggle(option.value)} />
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
                <span className="catalog-color-swatch" style={{ backgroundColor: option.color }} aria-hidden="true" />
                <span>{t(option.labelKey)}</span>
              </label>
            );
          })}
        </div>
        {availableColors.size === 0 && <p id={`${idPrefix}-color-note`} className="catalog-filter-note">{t("comingSoon")}</p>}
      </fieldset>

      {hasActiveFilters && <button type="button" className="catalog-clear-filters" onClick={onClear}>{t("clear")}</button>}
    </div>
  );
}
