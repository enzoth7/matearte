"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogValueMap } from "../../../../shared/catalog-taxonomy";
import type { Product } from "@/types/catalog";
import { getVariantColorId } from "@/lib/catalog-filters";

const ALL_TALLES = Array.from({ length: 13 }, (_, i) => String(i + 34)); // ['34','35',...,'46']

function valuesFor(product: Product, code: string) {
  const raw = [...new Set(product.variants.map(variant => variant.options?.[code] ?? (code === "color" ? getVariantColorId(variant) : undefined)).filter(value => value !== undefined).map(String))];
  if (code === "talle" && raw.includes("todos")) {
    return ALL_TALLES;
  }
  return raw;
}

export function useStructuredVariantSelection(product: Product) {
  const axes = useMemo(() => {
    const keys = new Set<string>();
    product.variants.forEach(variant => Object.keys(variant.options ?? {}).forEach(key => keys.add(key)));
    if (product.variants.some(variant=>Boolean(getVariantColorId(variant)))) keys.add("color");
    return [...keys].sort((a,b)=>a === "color" ? -1 : b === "color" ? 1 : a.localeCompare(b));
  }, [product]);
  const [selected, setSelected] = useState<CatalogValueMap>({});

  useEffect(() => {
    const next: CatalogValueMap = {};
    const requestedColor = new URLSearchParams(window.location.search).get("color");
    axes.forEach(axis => {
      const values = valuesFor(product, axis);
      if (axis === "color" && requestedColor && values.includes(requestedColor)) next.color = requestedColor;
      else if (values.length === 1) next[axis] = values[0];
    });
    setSelected(next);
  }, [axes, product]);

  const matches = product.variants.filter(variant => Object.entries(selected).every(([code, value]) => {
    const variantValue = variant.options?.[code] ?? (code === "color" ? getVariantColorId(variant) : undefined);
    if (String(variantValue ?? "") === "todos") return true;
    return String(variantValue ?? "") === String(value);
  }));
  const complete = axes.every(axis => selected[axis] !== undefined && selected[axis] !== "");
  const activeVariant = complete ? matches[0] : undefined;
  const priceVariant = [...matches].sort((a,b)=>(a.price?.amountMinor??Infinity)-(b.price?.amountMinor??Infinity))[0];
  const selectedColor = typeof selected.color === "string" ? selected.color : undefined;
  const colorImages = selectedColor ? product.images.filter(image=>image.optionValues?.color===selectedColor) : [];
  const legacyImages = activeVariant ? product.images.filter(image=>image.variantId===activeVariant.id) : [];
  const generalImages = product.images.filter(image=>!image.variantId && !image.optionValues?.color);
  const images = colorImages.length ? [...colorImages,...generalImages] : legacyImages.length ? [...legacyImages,...generalImages] : product.images;

  return {
    axes: axes.map(code=>({ code, values: valuesFor(product,code) })),
    selected,
    select: (code:string,value:string) => setSelected(current=>({...current,[code]:value})),
    activeVariant,
    displayedPrice: priceVariant?.price?.amountMinor ? priceVariant.price.amountMinor / 100 : product.filterData.priceUYU,
    priceIsFrom: !complete && matches.length > 1,
    images,
    complete,
  };
}
