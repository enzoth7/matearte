import type { CSSProperties } from "react";
import type { CatalogValueMap } from "../../../shared/catalog-taxonomy";

const numberValue = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;

export function catalogCoverStyle(optionValues?: CatalogValueMap): CSSProperties | undefined {
  if (!optionValues) return undefined;
  const hasCrop = ["cover_x", "cover_y", "cover_zoom"].some((key) => typeof optionValues[key] === "number");
  if (!hasCrop) return undefined;

  const x = Math.min(40, Math.max(-40, numberValue(optionValues.cover_x, 0)));
  const y = Math.min(40, Math.max(-40, numberValue(optionValues.cover_y, 0)));
  const zoom = Math.min(2.5, Math.max(1, numberValue(optionValues.cover_zoom, 1)));
  return {
    objectPosition: `${50 - x}% ${50 - y}%`,
    transform: `scale(${zoom})`,
  };
}
