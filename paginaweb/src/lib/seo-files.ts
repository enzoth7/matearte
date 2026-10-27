import type { MetadataRoute } from "next";
import { products } from "@/data/catalog";
import { localizedPathname, type RouteHref } from "@/i18n/metadata";
import { absoluteUrl, siteUrl } from "@/lib/metadata";
import { categoryPageSlugs, productInCategory } from "@/lib/catalog-filters";

export function buildRobotsFile(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

export function buildManifestFile(): MetadataRoute.Manifest {
  return {
    name: "MateArte Uruguay — Arte & Tradición",
    short_name: "MateArte",
    description: "Mates uruguayos, bombillas, materas y regalos personalizados elaborados con tradición artesanal en Paysandú.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f0e8",
    theme_color: "#79452d",
    lang: "es-UY",
    icons: [
      {
        src: "/icon.jpg",
        sizes: "1080x1080",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
  };
}

function toDate(timestamp?: number) {
  return timestamp && Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp) : undefined;
}

export function buildSitemapFile(catalogProducts = products): MetadataRoute.Sitemap {
  // Solo se informa lastmod donde hay una fecha real: el catálogo cambia cuando cambia algún producto.
  const catalogModified = toDate(Math.max(0, ...catalogProducts.map((product) => product.lastModifiedAt ?? 0)));
  const staticRoutes = [
    {
      href: "/" as const,
      changeFrequency: "weekly" as const,
      priority: 1,
      images: [
        "/assets/matearte/home-v2/craft-hands.webp",
        "/assets/matearte/home-v2/mate-imperial.webp",
        "/assets/matearte/home-v2/store.webp",
      ],
    },
    {
      href: "/catalogo" as const,
      changeFrequency: "weekly" as const,
      priority: 0.9,
      lastModified: catalogModified,
      images: ["/assets/matearte/catalog-desktop/hero.webp"],
    },
    {
      href: "/personalizados" as const,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      images: ["/assets/matearte/personalizados-desktop/hero.webp"],
    },
    {
      href: "/empresas" as const,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      images: [
        "/assets/matearte/regalos-empresariales/Grido.jpeg",
        "/assets/matearte/regalos-empresariales/Publiled1.webp",
        "/assets/matearte/regalos-empresariales/Nutex1.webp",
      ],
    },
    { href: "/clientes" as const, changeFrequency: "monthly" as const, priority: 0.7, images: [] },
    {
      href: "/nosotros" as const,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      images: ["/assets/matearte/nosotros-desktop/paysandu-mundo.webp"],
    },
    {
      href: "/contacto" as const,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      images: ["/assets/matearte/contact-desktop/local.webp"],
    },
    { href: "/preguntas-frecuentes" as const, changeFrequency: "monthly" as const, priority: 0.6, images: [] },
    { href: "/compras/condiciones-de-compra" as const, changeFrequency: "yearly" as const, priority: 0.3, images: [] },
    { href: "/compras/envios" as const, changeFrequency: "yearly" as const, priority: 0.3, images: [] },
    { href: "/compras/terminos-y-condiciones" as const, changeFrequency: "yearly" as const, priority: 0.3, images: [] },
    { href: "/compras/politica-de-privacidad" as const, changeFrequency: "yearly" as const, priority: 0.3, images: [] },
  ];
  const locales = ["es", "en", "pt"] as const;
  const languageLinks = (href: RouteHref) => ({
    "es-UY": absoluteUrl(localizedPathname("es", href)),
    en: absoluteUrl(localizedPathname("en", href)),
    "pt-BR": absoluteUrl(localizedPathname("pt", href)),
    "x-default": absoluteUrl(localizedPathname("es", href)),
  });

  const staticEntries = staticRoutes.flatMap((route) => locales.map((locale) => ({
    url: absoluteUrl(localizedPathname(locale, route.href)),
    ...("lastModified" in route && route.lastModified ? { lastModified: route.lastModified } : {}),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    alternates: { languages: languageLinks(route.href) },
    images: route.images.map(absoluteUrl),
  })));
  // Solo las categorías con productos publicados tienen página.
  const categoryEntries = categoryPageSlugs.flatMap((categoria) => {
    const inCategory = catalogProducts.filter((product) => productInCategory(product, categoria));
    if (inCategory.length === 0) return [];
    const href = { pathname: "/catalogo/[categoria]" as const, params: { categoria } };
    const lastModified = toDate(Math.max(0, ...inCategory.map((product) => product.lastModifiedAt ?? 0)));
    return locales.map((locale) => ({
      url: absoluteUrl(localizedPathname(locale, href)),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      alternates: { languages: languageLinks(href) },
      images: inCategory.slice(0, 3).flatMap((product) => product.images.slice(0, 1).map((image) => absoluteUrl(image.src))),
    }));
  });
  const productEntries = catalogProducts.flatMap((product) => {
    const href = { pathname: "/producto/[slug]" as const, params: { slug: product.slug } };
    const lastModified = toDate(product.lastModifiedAt);
    return locales.map((locale) => ({
      url: absoluteUrl(localizedPathname(locale, href)),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: { languages: languageLinks(href) },
      images: product.images.map((image) => absoluteUrl(image.src)),
    }));
  });

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
