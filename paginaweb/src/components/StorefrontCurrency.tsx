"use client";

import { createContext, useContext, useState, useMemo } from "react";
import { useLocale } from "next-intl";
import type { Currency, Product } from "@/types/catalog";

const CurrencyContext = createContext({ currency: "UYU" as Currency, arsPerUyu: 0, arsUseBasePrice: false, setCurrency: (_value: Currency) => {} });

export function StorefrontCurrency({ children, initialCurrency, arsPerUyu, arsUseBasePrice = false }: { children: React.ReactNode; initialCurrency: Currency; arsPerUyu: number; arsUseBasePrice?: boolean }) {
  const locale = useLocale();
  const [spanishCurrency, setSpanishCurrency] = useState<Currency>(initialCurrency);
  const currency: Currency = locale === "en" ? "USD" : locale === "pt" ? "BRL" : spanishCurrency === "ARS" && arsPerUyu > 0 ? "ARS" : "UYU";
  const setCurrency = (value: Currency) => {
    if (locale !== "es" || !["UYU", "ARS"].includes(value) || (value === "ARS" && !arsPerUyu)) return;
    setSpanishCurrency(value);
    document.cookie = `MATEARTE_CURRENCY=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };
  return <CurrencyContext.Provider value={{ currency, setCurrency, arsPerUyu, arsUseBasePrice }}>{children}</CurrencyContext.Provider>;
}

export function useStorefrontCurrency(exchangeRates?: Record<string, number>) {
  const value = useContext(CurrencyContext);
  return { ...value, rates: { ...exchangeRates, ...(value.arsPerUyu > 0 ? { ARS: 1 / value.arsPerUyu } : {}) } };
}

export function CurrencySelector() {
  const locale = useLocale();
  const { currency, setCurrency, arsPerUyu } = useStorefrontCurrency();
  return <label className="home-currency-selector"><span className="sr-only">{locale === "en" ? "Currency" : locale === "pt" ? "Moeda" : "Moneda"}</span><select aria-label={locale === "en" ? "Currency" : locale === "pt" ? "Moeda" : "Moneda"} value={currency} onChange={event => setCurrency(event.target.value as Currency)} disabled={locale !== "es"}>
    {locale === "es" ? <><option value="UYU">UYU</option>{arsPerUyu > 0 && <option value="ARS">ARS</option>}</> : <option value={currency}>{currency}</option>}
  </select></label>;
}

export function useStorefrontProduct(product: Product) {
  const { currency, arsUseBasePrice } = useStorefrontCurrency();
  return useMemo(() => {
    if (currency !== "ARS" || !arsUseBasePrice) return product;
    const variants = product.variants.map(variant => ({ ...variant, price: variant.basePrice ?? variant.price }));
    const prices = variants.flatMap(variant => variant.price ? [variant.price.amountMinor / 100] : []);
    return { ...product, variants, filterData: { ...product.filterData, priceUYU: prices.length ? Math.min(...prices) : product.filterData.priceUYU } };
  }, [product, currency, arsUseBasePrice]);
}
