import type { Locale } from "@/types/catalog";
import { localizedPathnames } from "./routing";

const dynamicRoutes = ["/producto/[slug]", "/pedidos/[id]"] as const;

function removeLocalePrefix(pathname: string) {
  return pathname.replace(/^\/(en|pt)(?=\/|$)/, "") || "/";
}

export function canonicalPathname(pathname: string, locale: Locale) {
  const bare = removeLocalePrefix(pathname);

  for (const [canonical, localized] of Object.entries(localizedPathnames)) {
    const visible = typeof localized === "string" ? localized : localized[locale];
    if (visible === bare || canonical === bare) return canonical;
  }

  for (const canonical of dynamicRoutes) {
    const localized = localizedPathnames[canonical];
    const visible = localized[locale];
    const canonicalPrefix = canonical.slice(0, canonical.lastIndexOf("/"));
    const visiblePrefix = visible.slice(0, visible.lastIndexOf("/"));
    const matchedPrefix = bare.startsWith(`${visiblePrefix}/`) ? visiblePrefix : bare.startsWith(`${canonicalPrefix}/`) ? canonicalPrefix : null;
    if (matchedPrefix) return `${canonicalPrefix}/${bare.slice(matchedPrefix.length + 1)}`;
  }

  return bare;
}

export function localizeCurrentPathname(pathname: string, currentLocale: Locale, targetLocale: Locale) {
  const canonical = canonicalPathname(pathname, currentLocale);

  return localizeCanonicalPath(canonical, targetLocale);
}

export function localizeCanonicalPath(canonical: string, targetLocale: Locale) {

  for (const route of dynamicRoutes) {
    const canonicalPrefix = route.slice(0, route.lastIndexOf("/"));
    if (canonical.startsWith(`${canonicalPrefix}/`)) {
      const value = canonical.slice(canonicalPrefix.length + 1);
      const localized = localizedPathnames[route][targetLocale];
      const visiblePrefix = localized.slice(0, localized.lastIndexOf("/"));
      return `${targetLocale === "es" ? "" : `/${targetLocale}`}${visiblePrefix}/${value}`;
    }
  }

  const localized = localizedPathnames[canonical as keyof typeof localizedPathnames];
  const visible = localized ? (typeof localized === "string" ? localized : localized[targetLocale]) : canonical;
  return `${targetLocale === "es" ? "" : `/${targetLocale}`}${visible === "/" ? "" : visible}` || "/";
}
