import type { AppLocale } from "@/i18n/routing";
import { localeConfig } from "@/i18n/config";
import { localizedPathname, type RouteHref } from "@/i18n/metadata";
import { es } from "@/content/es";
import type { CategorySlug, Product } from "@/types/catalog";
import { absoluteUrl } from "@/lib/metadata";

type StructuredPageType = "AboutPage" | "CollectionPage" | "ContactPage" | "WebPage";

type Breadcrumb = {
  name: string;
  href: RouteHref;
};

const organizationId = absoluteUrl("/#organization");
const websiteId = absoluteUrl("/#website");

export function localizedAbsoluteUrl(locale: AppLocale, href: RouteHref) {
  return absoluteUrl(localizedPathname(locale, href));
}

function organizationNode(description: string) {
  return {
    "@type": ["OnlineStore", "LocalBusiness"],
    "@id": organizationId,
    name: es.brand.name,
    alternateName: es.brand.shortName,
    url: absoluteUrl(),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/assets/matearte/01-marca/LogoOriginal-4k.png"),
      width: 4096,
      height: 4096,
    },
    image: absoluteUrl("/assets/matearte/nosotros-desktop/paysandu-mundo.png"),
    description,
    email: es.contact.email,
    telephone: es.contact.phoneHref,
    address: {
      "@type": "PostalAddress",
      streetAddress: "25 de Mayo 1734",
      addressLocality: "Paysandú",
      addressCountry: "UY",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: es.contact.phoneHref,
      email: es.contact.email,
      availableLanguage: ["Spanish", "English", "Portuguese"],
      areaServed: "Worldwide",
    },
    currenciesAccepted: "UYU",
    sameAs: [es.contact.instagramUrl],
  };
}

function websiteNode(locale: AppLocale, description: string) {
  return {
    "@type": "WebSite",
    "@id": websiteId,
    url: absoluteUrl(),
    name: es.brand.name,
    alternateName: es.brand.shortName,
    description,
    inLanguage: localeConfig[locale].htmlLang,
    publisher: { "@id": organizationId },
  };
}

function breadcrumbNode(locale: AppLocale, breadcrumbs: Breadcrumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((breadcrumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: breadcrumb.name,
      item: localizedAbsoluteUrl(locale, breadcrumb.href),
    })),
  };
}

export function buildSiteStructuredData(locale: AppLocale, description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationNode(description), websiteNode(locale, description)],
  };
}

export function buildPageStructuredData({
  locale,
  href,
  name,
  description,
  type = "WebPage",
  homeLabel,
  includeOrganization = false,
}: {
  locale: AppLocale;
  href: RouteHref;
  name: string;
  description: string;
  type?: StructuredPageType;
  homeLabel: string;
  includeOrganization?: boolean;
}) {
  const url = localizedAbsoluteUrl(locale, href);
  const graph: Record<string, unknown>[] = [
    {
      "@type": type,
      "@id": `${url}#webpage`,
      url,
      name,
      description,
      inLanguage: localeConfig[locale].htmlLang,
      isPartOf: { "@id": websiteId },
      ...(type === "AboutPage" ? { about: { "@id": organizationId } } : {}),
      ...(type === "ContactPage" ? { mainEntity: { "@id": organizationId } } : {}),
    },
    breadcrumbNode(locale, [
      { name: homeLabel, href: "/" },
      { name, href },
    ]),
  ];

  if (includeOrganization) graph.unshift(organizationNode(description));

  return { "@context": "https://schema.org", "@graph": graph };
}

export function buildCatalogStructuredData(
  locale: AppLocale,
  products: Product[],
  name: string,
  description: string,
  homeLabel: string,
) {
  const href = "/catalogo" as const;
  const url = localizedAbsoluteUrl(locale, href);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        url,
        name,
        description,
        inLanguage: localeConfig[locale].htmlLang,
        isPartOf: { "@id": websiteId },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: products.length,
          itemListElement: products.map((product, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: product.name,
            url: localizedAbsoluteUrl(locale, {
              pathname: "/producto/[slug]",
              params: { slug: product.slug },
            }),
          })),
        },
      },
      breadcrumbNode(locale, [
        { name: homeLabel, href: "/" },
        { name, href },
      ]),
    ],
  };
}

export function buildProductStructuredData(
  locale: AppLocale,
  product: Product,
  catalogLabel: string,
  homeLabel: string,
) {
  const href = { pathname: "/producto/[slug]" as const, params: { slug: product.slug } };
  const url = localizedAbsoluteUrl(locale, href);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        sku: product.id,
        name: product.name,
        description: product.summary,
        image: product.images.map((image) => absoluteUrl(image.src)),
        category: product.category,
        material: product.materials,
        url,
        brand: { "@type": "Brand", name: es.brand.shortName },
        manufacturer: { "@id": organizationId },
      },
      breadcrumbNode(locale, [
        { name: homeLabel, href: "/" },
        { name: catalogLabel, href: "/catalogo" },
        { name: product.name, href },
      ]),
    ],
  };
}

export function productSeoCopy(product: Product, locale: AppLocale) {
  const titles: Record<AppLocale, Record<CategorySlug, string>> = {
    es: {
      mates: `${product.name} uruguayo artesanal`,
      bombillas: `${product.name} para mate uruguayo`,
      materas: `${product.name} artesanal`,
      termos: `${product.name} para mate`,
      regalos: `${product.name} personalizado`,
      dama: `${product.name} de cuero artesanal`,
      caballero: `${product.name} de cuero artesanal`,
    },
    en: {
      mates: `${product.name}, handmade Uruguayan mate gourd`,
      bombillas: `${product.name} for yerba mate`,
      materas: `${product.name}, handcrafted mate bag`,
      termos: `${product.name} for yerba mate`,
      regalos: `${product.name}, personalized Uruguayan gift`,
      dama: `${product.name}, handcrafted leather accessory`,
      caballero: `${product.name}, handcrafted leather accessory`,
    },
    pt: {
      mates: `${product.name}, cuia uruguaia artesanal`,
      bombillas: `${product.name} para mate`,
      materas: `${product.name} artesanal`,
      termos: `${product.name} para mate`,
      regalos: `${product.name}, presente uruguaio personalizado`,
      dama: `${product.name}, acessório artesanal de couro`,
      caballero: `${product.name}, acessório artesanal de couro`,
    },
  };
  const descriptions: Record<AppLocale, string> = {
    es: `${product.summary} Conocé sus materiales y opciones de personalización en el catálogo de MateArte Uruguay.`,
    en: `${product.summary} Explore its materials and customization options in the MateArte Uruguay catalog.`,
    pt: `${product.summary} Conheça seus materiais e opções de personalização no catálogo da MateArte Uruguai.`,
  };
  const fallbackTitles: Record<AppLocale, string> = {
    es: `${product.name} de MateArte Uruguay`,
    en: `${product.name} by MateArte Uruguay`,
    pt: `${product.name} da MateArte Uruguai`,
  };
  return {
    title: titles[locale][product.category as CategorySlug] ?? fallbackTitles[locale],
    description: descriptions[locale],
  };
}
