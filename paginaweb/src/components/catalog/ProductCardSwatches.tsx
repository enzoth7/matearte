"use client";

import type { ProductVariant } from "@/types/catalog";
import { getVariantColorHex } from "@/lib/catalog-filters";

type Props = {
  variants: ProductVariant[];
  highlightedVariantId?: string | null;
  onSelect: (variantId: string) => void;
  onHover: (variantId: string | null) => void;
};

export function ProductCardSwatches({
  variants,
  highlightedVariantId,
  onSelect,
  onHover,
}: Props) {
  if (!variants || variants.length <= 1) return null;

  return (
    <div
      className="catalog-product-swatches"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        marginTop: "0.5rem",
        flexWrap: "wrap",
      }}
      onClick={(e) => {
        // Prevent clicking outside swatches from bubbling to product Link
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {variants.map((v) => {
        const colorHex = getVariantColorHex(v);
        const isHighlighted = highlightedVariantId === v.id;
        return (
          <span
            key={v.id}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(v.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onSelect(v.id);
              }
            }}
            onMouseEnter={() => onHover(v.id)}
            onMouseLeave={() => onHover(null)}
            style={{
              display: "inline-block",
              height: "0.875rem",
              width: "0.875rem",
              borderRadius: "50%",
              backgroundColor: colorHex,
              border: "1px solid rgba(0, 0, 0, 0.15)",
              boxShadow: isHighlighted
                ? "0 0 0 2px #fff, 0 0 0 3.5px #2d1d16"
                : "none",
              transform: isHighlighted ? "scale(1.15)" : "scale(1)",
              cursor: "pointer",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            title={v.label}
            aria-label={v.label}
            aria-pressed={isHighlighted}
          />
        );
      })}
    </div>
  );
}
