"use client";

import { useState, useEffect, useMemo } from "react";
import type { CatalogColorId, Product, ProductVariant } from "@/types/catalog";
import {
  findMatchingVariantForColors,
  getVariantColorId,
} from "@/lib/catalog-filters";

export function useProductCardVariant(
  product: Product,
  activeFilterColors: CatalogColorId[] = []
) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [hoveredVariantId, setHoveredVariantId] = useState<string | null>(null);

  // Reset manual card selection when sidebar color filters change
  useEffect(() => {
    setSelectedVariantId(null);
  }, [activeFilterColors]);

  const activeVariant = useMemo<ProductVariant | undefined>(() => {
    if (hoveredVariantId) {
      return product.variants?.find((v) => v.id === hoveredVariantId);
    }
    if (selectedVariantId) {
      return product.variants?.find((v) => v.id === selectedVariantId);
    }
    if (activeFilterColors.length > 0) {
      const byExplicitColor = product.variants?.find((v) => v.color && activeFilterColors.includes(v.color));
      return byExplicitColor ?? findMatchingVariantForColors(product, activeFilterColors);
    }
    return undefined;
  }, [hoveredVariantId, selectedVariantId, activeFilterColors, product]);

  const matchedFilterVariant = useMemo(() => {
    if (activeFilterColors.length === 0) return undefined;
    const byExplicitColor = product.variants?.find((v) => v.color && activeFilterColors.includes(v.color));
    return byExplicitColor ?? findMatchingVariantForColors(product, activeFilterColors);
  }, [activeFilterColors, product]);

  const highlightedVariantId =
    hoveredVariantId ||
    selectedVariantId ||
    matchedFilterVariant?.id ||
    null;

  const variantImage = activeVariant
    ? product.images?.find((img) => img.variantId === activeVariant.id)
    : undefined;

  const displayedPrice = activeVariant?.price?.amountMinor
    ? activeVariant.price.amountMinor / 100
    : product.filterData.priceUYU;

  const hasMultipleVariants = Boolean(product.variants && product.variants.length > 1);
  const colorVariants = hasMultipleVariants
    ? product.variants.filter(
        (v) =>
          Boolean(v.color) ||
          getVariantColorId(v) !== undefined ||
          product.images?.some((img) => img.variantId === v.id)
      )
    : [];
  const swatchesToShow =
    colorVariants.length > 0
      ? colorVariants
      : hasMultipleVariants
      ? product.variants
      : [];

  const handleSelectVariant = (variantId: string) => {
    setSelectedVariantId((prev) => (prev === variantId ? null : variantId));
  };

  return {
    activeVariant,
    highlightedVariantId,
    variantImage,
    displayedPrice,
    swatchesToShow,
    hoveredVariantId,
    setHoveredVariantId,
    selectedVariantId,
    handleSelectVariant,
  };
}
