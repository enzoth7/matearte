import { formatMoney } from "@/lib/money";
import type { Currency, Locale } from "@/types/catalog";

export type OrderMoneySource = {
  total_minor: number;
  currency: string;
  paypal_amount_usd_minor?: number | null;
};

const currencies: Currency[] = ["UYU", "USD", "BRL"];

function sourceCurrency(value: string): Currency {
  return currencies.includes(value as Currency) ? value as Currency : "UYU";
}

/**
 * Formats an order amount in the storefront currency for the active language.
 * PayPal's captured USD total is used as the exact source for English order
 * totals, so a historical purchase is not recalculated with today's USD rate.
 */
export function formatOrderMoney(
  order: OrderMoneySource,
  amountMinor: number,
  locale: Locale,
  exchangeRates?: Record<string, number>,
) {
  const paypalTotal = Number(order.paypal_amount_usd_minor);
  if (locale === "en" && Number.isSafeInteger(paypalTotal) && paypalTotal >= 0 && order.total_minor > 0) {
    const amountUsdMinor = amountMinor === order.total_minor
      ? paypalTotal
      : Math.round((amountMinor * paypalTotal) / order.total_minor);
    return formatMoney(amountUsdMinor, "USD", locale);
  }

  return formatMoney(amountMinor, sourceCurrency(order.currency), locale, exchangeRates);
}
