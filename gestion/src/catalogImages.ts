import type { CommerceImage, CommerceVariant } from "./commerceSource";

const colorOf = (value: unknown) => typeof value === "string" ? value.trim().toLocaleLowerCase("es") : "";

export function imageForVariant(images: CommerceImage[], variant: CommerceVariant | null): CommerceImage | undefined {
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const color = colorOf(variant?.option_values?.color || variant?.color);
  if (variant) {
    const exact = sorted.find(image => image.variant_id === variant.id);
    if (exact) return exact;
    const byColor = color && sorted.find(image => !image.variant_id && colorOf(image.option_values?.color) === color);
    if (byColor) return byColor;
  }
  return sorted.find(image => !image.variant_id && !colorOf(image.option_values?.color))
    ?? (!variant ? sorted[0] : undefined);
}
