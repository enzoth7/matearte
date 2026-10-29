export type ArgentinaSettings = { enabled: boolean; ars_per_uyu: number; bank_name: string; account_holder: string; cbu: string; alias: string };
export const argentinaShippingNotice = "Envío dentro de Argentina a cargo del destinatario. No incluido en el total.";
// Finance stores UYU per ARS; checkout uses the reciprocal, frozen per order.
export function arsPerUyuFromFinanceRate(rate: unknown): number {
  const value = Number(rate);
  return Number.isFinite(value) && value > 0 ? Math.round((1 / value) * 1_000_000) / 1_000_000 : 0;
}
export function argentinaReady(value: ArgentinaSettings | null): value is ArgentinaSettings {
  // CBU and alias are sufficient for domestic transfer; the holder is optional.
  return Boolean(value?.enabled && Number.isFinite(Number(value.ars_per_uyu)) && Number(value.ars_per_uyu) > 0 && value.bank_name.trim() && /^\d{22}$/.test(value.cbu) && value.alias.trim());
}
export function toArsMinor(uyuMinor: number, arsPerUyu: number) {
  if (!Number.isSafeInteger(uyuMinor) || uyuMinor < 0 || !Number.isFinite(arsPerUyu) || arsPerUyu <= 0) throw new Error("Cotización o importe inválido.");
  // Match Postgres numeric rounding to the nearest ARS 50 (ties round up).
  const scaledRate = Math.round(arsPerUyu * 1_000_000);
  if (!Number.isSafeInteger(scaledRate) || scaledRate < 1) throw new Error("Cotización fuera de rango.");
  const numerator = BigInt(uyuMinor) * BigInt(scaledRate);
  const amount = Number((numerator + BigInt(2_500_000_000)) / BigInt(5_000_000_000)) * 5000;
  if (!Number.isSafeInteger(amount)) throw new Error("Importe fuera de rango.");
  return amount;
}

export type ArgentinaDiscountQuote = {
  discountType: "percentage" | "fixed";
  discountValue: number;
  applicability: "all_items" | "design_items" | "categories";
  categoryCodes?: string[];
  includeDesignItems?: boolean;
};

export function argentinaDiscountMinor(
  quote: ArgentinaDiscountQuote,
  subtotalMinor: number,
  designSubtotalMinor: number,
  categorySubtotals: Record<string, number>,
  arsPerUyu: number,
) {
  const eligibleMinor = quote.applicability === "all_items"
    ? subtotalMinor
    : quote.applicability === "design_items"
      ? designSubtotalMinor
      : (quote.categoryCodes || []).reduce((sum, category) => sum + (categorySubtotals[category] || 0), quote.includeDesignItems ? designSubtotalMinor : 0);
  if (!Number.isSafeInteger(eligibleMinor) || eligibleMinor <= 0) throw new Error("discount:not_applicable");
  let amount: number;
  if (quote.discountType === "fixed") {
    amount = toArsMinor(quote.discountValue * 100, arsPerUyu);
  } else {
    const percentHundredths = Math.round(quote.discountValue * 100);
    const divisor = BigInt(50_000_000);
    amount = Number((BigInt(eligibleMinor) * BigInt(percentHundredths) + divisor / BigInt(2)) / divisor) * 5000;
  }
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount >= subtotalMinor || amount > eligibleMinor) throw new Error("discount:not_applicable");
  return amount;
}
