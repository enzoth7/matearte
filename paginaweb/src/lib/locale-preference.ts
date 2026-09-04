import type { Locale } from "@/types/catalog";

export function persistLocalePreference(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
