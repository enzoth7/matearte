export type WholesaleDiscountSettings = {
  wholesale_mate_discount_enabled: boolean;
  wholesale_mate_quantity_threshold: number;
  wholesale_mate_discount_percent: number;
};

export type WholesalePriceLine = {
  itemType: "catalog" | "design";
  quantity: number;
  unitPriceMinor: number;
  category?: string | null;
};

export const DEFAULT_WHOLESALE_DISCOUNT_SETTINGS: WholesaleDiscountSettings = {
  wholesale_mate_discount_enabled: true,
  wholesale_mate_quantity_threshold: 30,
  wholesale_mate_discount_percent: 30,
};

export function isWholesaleMateCategory(category?: string | null) {
  return String(category || "").trim().toLowerCase() === "mates";
}

export function applyWholesaleMateDiscount<T extends WholesalePriceLine>(
  lines: T[],
  settings: WholesaleDiscountSettings,
): T[] {
  const mateQuantity = lines.reduce(
    (total, line) => total + (line.itemType === "catalog" && isWholesaleMateCategory(line.category) ? Math.max(0, Number(line.quantity) || 0) : 0),
    0,
  );
  const enabled = settings.wholesale_mate_discount_enabled
    && mateQuantity >= settings.wholesale_mate_quantity_threshold
    && settings.wholesale_mate_discount_percent > 0;

  if (!enabled) return lines.map((line) => ({ ...line }));
  const multiplier = 1 - settings.wholesale_mate_discount_percent / 100;
  return lines.map((line) => ({
    ...line,
    unitPriceMinor: line.itemType === "catalog" && isWholesaleMateCategory(line.category)
      ? Math.max(0, Math.round(line.unitPriceMinor * multiplier))
      : line.unitPriceMinor,
  }));
}
