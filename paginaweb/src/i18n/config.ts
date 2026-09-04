import type { Currency, Locale } from "@/types/catalog";

export const localeConfig: Record<Locale, {
  htmlLang: string;
  openGraphLocale: string;
  futureCurrency: Currency;
}> = {
  es: { htmlLang: "es-UY", openGraphLocale: "es_UY", futureCurrency: "UYU" },
  en: { htmlLang: "en", openGraphLocale: "en_US", futureCurrency: "USD" },
  pt: { htmlLang: "pt-BR", openGraphLocale: "pt_BR", futureCurrency: "BRL" },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "es" || value === "en" || value === "pt";
}
