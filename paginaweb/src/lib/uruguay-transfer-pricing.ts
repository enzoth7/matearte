export type UruguayTransferDiscount = { enabled: boolean; categories: string[]; designs: boolean };

export function appliesUruguayTransferDiscount(item: { item_type?: string; category?: string | null }, settings: UruguayTransferDiscount): boolean {
  if (!settings.enabled) return false;
  if (item.item_type === "design") return settings.designs;
  return settings.categories.includes((item.category || "").trim().toLowerCase());
}

export function uruguayTransferUnitPriceMinor(publishedUnitPriceMinor: number, eligible = true): number {
  return eligible ? Math.round(publishedUnitPriceMinor * 0.9) : publishedUnitPriceMinor;
}
