"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { localizeCurrentPathname } from "@/i18n/paths";
import { isLocale } from "@/i18n/config";
import { persistLocalePreference } from "@/lib/locale-preference";
import type { Locale } from "@/types/catalog";

const DISMISS_KEY = "matearte-language-notice-dismissed";

const copy: Record<Exclude<Locale, "es">, { text: string; action: string; close: string }> = {
  en: { text: "This site is also available in English.", action: "View in English", close: "Close" },
  pt: { text: "Este site também está disponível em português.", action: "Ver em português", close: "Fechar" },
};

function browserLocale(): Locale | null {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

/**
 * Sugiere el idioma del navegador cuando no coincide con el de la página, en lugar de redirigir:
 * así los buscadores y quien comparte un enlace siempre ven la URL pedida.
 */
export function LanguageNotice() {
  const locale = useLocale() as Locale;
  const [suggested, setSuggested] = useState<Exclude<Locale, "es"> | null>(null);

  useEffect(() => {
    if (locale !== "es" || document.cookie.includes("NEXT_LOCALE=")) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* sin almacenamiento */ }
    const preferred = browserLocale();
    if (!dismissed && preferred && preferred !== "es") setSuggested(preferred);
  }, [locale]);

  if (!suggested) return null;
  const text = copy[suggested];
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* sin almacenamiento */ }
    setSuggested(null);
  };

  return (
    <div className="language-notice" role="region" aria-label={text.text} lang={suggested}>
      <p>{text.text}</p>
      <a
        href={`${localizeCurrentPathname(window.location.pathname, "es", suggested)}${window.location.search}`}
        onClick={() => persistLocalePreference(suggested)}
      >
        {text.action}
      </a>
      <button type="button" onClick={dismiss} aria-label={text.close}>×</button>
    </div>
  );
}
