import type { Currency } from "@/types/catalog";

export function formatMoney(amountMinor: number, currency: Currency = "UYU") {
  const amount = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(amountMinor / 100);
  return `$ ${amount} ${currency}`;
}
