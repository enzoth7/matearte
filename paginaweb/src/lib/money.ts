import type { Currency } from "@/types/catalog";

export function formatMoney(amountMinor: number, currency: Currency = "UYU", locale = "es", exchangeRates?: Record<string, number>) {
  const amount = amountMinor / 100;
  if (locale === "en" && exchangeRates?.USD) {
    const usd = Math.round(amount / exchangeRates.USD);
    return `US$ ${new Intl.NumberFormat("en-US").format(usd)}`;
  }
  if (locale === "pt" && exchangeRates?.BRL) {
    const brl = Math.round(amount / exchangeRates.BRL);
    return `R$ ${new Intl.NumberFormat("pt-BR").format(brl)}`;
  }
  const formatted = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(amount);
  return `$ ${formatted} ${currency}`;
}
