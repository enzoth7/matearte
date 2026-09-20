import type { Currency } from "@/types/catalog";

export function formatMoney(amountMinor: number, currency: Currency = "UYU", locale = "es", exchangeRates?: Record<string, number>) {
  const amount = amountMinor / 100;
  if (locale === "en") {
    const usd = currency === "USD"
      ? amount
      : exchangeRates?.USD
        ? Math.round((currency === "UYU" ? amount : amount * (exchangeRates[currency] || 1)) / exchangeRates.USD)
        : null;
    if (usd !== null) {
      return `US$ ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(usd)}`;
    }
  }
  if (locale === "pt") {
    const brl = currency === "BRL"
      ? amount
      : exchangeRates?.BRL
        ? Math.round((currency === "UYU" ? amount : amount * (exchangeRates[currency] || 1)) / exchangeRates.BRL)
        : null;
    if (brl !== null) {
      return `R$ ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(brl)}`;
    }
  }
  const formatted = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: currency === "UYU" ? 0 : 2 }).format(amount);
  return `$ ${formatted} ${currency}`;
}
