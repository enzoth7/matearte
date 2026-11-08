import { commerceSource } from "./commerceSource";
import { money } from "./data";

export type FinanceCurrency = "UYU" | "USD" | "ARS";

export const financeAmountLabel = (amountMinor: number, currency: FinanceCurrency) => currency === "UYU"
  ? money(amountMinor / 100)
  : new Intl.NumberFormat("es-UY", { style: "currency", currency, currencyDisplay: "code" }).format(amountMinor / 100);

export const financeUyuMinor = (amountMinor: number, currency: FinanceCurrency, rate: number | null) => {
  if (currency === "UYU") return amountMinor;
  return rate !== null && Number.isFinite(rate) && rate > 0 ? Math.round(amountMinor * rate) : null;
};

export async function readCurrentFinanceRate(currency: Exclude<FinanceCurrency, "UYU">): Promise<number> {
  if (!commerceSource) throw new Error("El comercio no está conectado.");
  const { data, error } = await commerceSource.from("commerce_exchange_rates")
    .select("currency_code,rate_to_uyu");
  const rate = Number((data || []).find((row) => row.currency_code === currency)?.rate_to_uyu);
  if (error || !Number.isFinite(rate) || rate <= 0) throw new Error(`Falta la cotización de ${currency}.`);
  return rate;
}
