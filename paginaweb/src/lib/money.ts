import type { Currency } from "@/types/catalog";
import { toArsMinor } from "./argentina";

export function formatMoney(amountMinor: number, currency: Currency = "UYU", locale = "es", exchangeRates?: Record<string, number>, targetCurrency?: Currency) {
  const amount = amountMinor / 100;
  if (currency === "ARS" || targetCurrency === "ARS") {
    if (currency !== "ARS" && !exchangeRates?.ARS) return "Cotización ARS no disponible";
    const ars = currency === "ARS" ? amount : toArsMinor(amountMinor, 1 / exchangeRates!.ARS) / 100;
    return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(ars)} ARS`;
  }
  if (locale === "en") {
    const usd = currency === "USD"
      ? amount
      : exchangeRates?.USD
        ? Math.round((currency === "UYU" ? amount : amount * (exchangeRates[currency] || 1)) / exchangeRates.USD)
        : null;
    if (usd !== null) {
      return `US$ ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(usd)} USD`;
    }
  }
  if (locale === "pt") {
    const brl = currency === "BRL"
      ? amount
      : exchangeRates?.BRL
        ? Math.round((currency === "UYU" ? amount : amount * (exchangeRates[currency] || 1)) / exchangeRates.BRL)
        : null;
    if (brl !== null) {
      return `R$ ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(brl)} BRL`;
    }
  }
  const formatted = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: currency === "UYU" ? 0 : 2 }).format(amount);
  return `$ ${formatted} ${currency}`;
}
