"use client";

import { useEffect, useMemo, useState } from "react";
import { catalogPurchaseAxes, defaultCatalogTaxonomy, type CatalogPurchaseAxis, type CatalogValueMap } from "../../../../shared/catalog-taxonomy";
import type { Product } from "@/types/catalog";
import { getVariantColorId } from "@/lib/catalog-filters";

export function useStructuredVariantSelection(product: Product) {
  const axes = useMemo(() => {
    const colorValues = [...new Set(product.variants.map(variant => getVariantColorId(variant)).filter((value): value is NonNullable<typeof value> => Boolean(value)))];
    const colorAxis: CatalogPurchaseAxis[] = colorValues.length
      ? [{ code: "color", label: "Color", values: colorValues.map(value => ({ value, label: product.variants.find(variant => getVariantColorId(variant) === value)?.label ?? value })) }]
      : [];
    return [...colorAxis, ...(product.purchaseAxes ?? catalogPurchaseAxes(defaultCatalogTaxonomy, product.category, product.attributes ?? {}, product.name))];
  }, [product]);
  const [selected, setSelected] = useState<CatalogValueMap>({});

  useEffect(() => {
    const next: CatalogValueMap = {};
    const requestedColor = new URLSearchParams(window.location.search).get("color");
    axes.forEach(axis => {
      const values = axis.values.map(option => option.value);
      if (axis.code === "color" && requestedColor && values.includes(requestedColor)) next.color = requestedColor;
      else if (values.length === 1) next[axis.code] = values[0];
    });
    setSelected(next);
  }, [axes]);

  const matches = product.variants.filter(variant => !selected.color || getVariantColorId(variant) === selected.color);
  const complete = axes.every(axis => axis.values.length > 0 && axis.values.some(option => option.value === selected[axis.code])) && matches.length > 0;
  const activeVariant = complete ? matches[0] : undefined;
  const priceVariant = [...matches].sort((a,b)=>(a.price?.amountMinor??Infinity)-(b.price?.amountMinor??Infinity))[0];
  const selectedColor = typeof selected.color === "string" ? selected.color : undefined;
  const colorImages = selectedColor ? product.images.filter(image=>image.optionValues?.color===selectedColor) : [];
  const legacyImages = activeVariant ? product.images.filter(image=>image.variantId===activeVariant.id) : [];
  const generalImages = product.images.filter(image=>!image.variantId && !image.optionValues?.color);
  const images = colorImages.length ? [...colorImages,...generalImages] : legacyImages.length ? [...legacyImages,...generalImages] : product.images;

  return {
    axes,
    selected,
    select: (code:string,value:string) => setSelected(current=>({...current,[code]:value})),
    activeVariant,
    displayedPrice: priceVariant?.price?.amountMinor ? priceVariant.price.amountMinor / 100 : product.filterData.priceUYU,
    priceIsFrom: !complete && matches.length > 1,
    images,
    complete,
  };
}
