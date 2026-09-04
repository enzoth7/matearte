import type { Metadata } from "next";
import type { AppLocale } from "@/i18n/routing";
import { localizedPathnames } from "@/i18n/routing";
import { localizeCanonicalPath } from "@/i18n/paths";

type DynamicRouteHref =
  | { pathname: "/producto/[slug]"; params: { slug: string } }
  | { pathname: "/pedidos/[id]"; params: { id: string } };

export type RouteHref = keyof typeof localizedPathnames | DynamicRouteHref;

function canonicalHref(href: RouteHref) {
  if (typeof href === "string") return href;
  return Object.entries(href.params).reduce(
    (pathname, [key, value]) => pathname.replace(`[${key}]`, encodeURIComponent(value)),
    href.pathname as string,
  );
}

export function localizedPathname(locale: AppLocale, href: RouteHref) {
  return localizeCanonicalPath(canonicalHref(href), locale);
}

type SocialImage = {
  url: string;
  width: number;
  height: number;
  alt: string;
};

type PageMetadataOptions = {
  image?: SocialImage;
  socialTitle?: string;
  socialDescription?: string;
};

const socialImageAlt: Record<AppLocale, string> = {
  es: "Taller artesanal de MateArte en Paysandú, Uruguay",
  en: "MateArte artisan workshop in Paysandú, Uruguay",
  pt: "Oficina artesanal da MateArte em Paysandú, Uruguai",
};

export function defaultSocialImage(locale: AppLocale): SocialImage {
  return {
    url: "/assets/matearte/nosotros-desktop/paysandu-mundo.png",
    width: 2554,
    height: 1438,
    alt: socialImageAlt[locale],
  };
}

export function localizedAlternates(locale: AppLocale, href: RouteHref): Metadata["alternates"] {
  return {
    canonical: localizedPathname(locale, href),
    languages: {
      "es-UY": localizedPathname("es", href),
      en: localizedPathname("en", href),
      "pt-BR": localizedPathname("pt", href),
      "x-default": localizedPathname("es", href),
    },
  };
}

export function localizedOpenGraph(
  locale: AppLocale,
  href: RouteHref,
  title: string,
  description: string,
  image: SocialImage = defaultSocialImage(locale),
): Metadata["openGraph"] {
  return {
    type: "website",
    title,
    description,
    url: localizedPathname(locale, href),
    locale: locale === "es" ? "es_UY" : locale === "pt" ? "pt_BR" : "en_US",
    alternateLocale: ["es_UY", "en_US", "pt_BR"].filter((value) => value !== (locale === "es" ? "es_UY" : locale === "pt" ? "pt_BR" : "en_US")),
    siteName: "MateArte Uruguay",
    images: [image],
  };
}

export function localizedPageMetadata(
  locale: AppLocale,
  href: RouteHref,
  title: string,
  description: string,
  options: PageMetadataOptions = {},
): Metadata {
  const image = options.image ?? defaultSocialImage(locale);
  const socialTitle = options.socialTitle ?? title;
  const socialDescription = options.socialDescription ?? description;

  return {
    title,
    description,
    alternates: localizedAlternates(locale, href),
    openGraph: localizedOpenGraph(locale, href, socialTitle, socialDescription, image),
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: socialDescription,
      images: [image],
    },
  };
}
