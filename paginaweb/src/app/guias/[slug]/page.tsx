import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound, permanentRedirect } from "next/navigation";
import { GuiaDetalle } from "@/components/GuidePage";
import { JsonLd } from "@/components/JsonLd";
import { guiaPorSlug, guias, slugsDeGuia, traduccionDeGuia } from "@/content/guias";
import { localizedPageMetadata, localizedPathname } from "@/i18n/metadata";
import type { AppLocale } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/metadata";

export function generateStaticParams() {
  return guias.es.map((guia) => ({ slug: guia.slug }));
}

const idiomaSchema: Record<AppLocale, string> = { es: "es-UY", en: "en", pt: "pt-BR" };
const sinMarcas = (texto: string) => texto.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
const rutaGuia = (locale: AppLocale, slug: string) => localizedPathname(locale, { pathname: "/guias/[slug]", params: { slug } });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const guia = guiaPorSlug(locale, slug);
  if (!guia) return {};
  const slugs = slugsDeGuia(guia.id);
  const metadata = localizedPageMetadata(locale, { pathname: "/guias/[slug]", params: { slug } }, guia.tituloSeo, guia.descripcion);
  // Cada traducción tiene su propio slug: los hreflang apuntan a cada una.
  return {
    ...metadata,
    alternates: {
      canonical: rutaGuia(locale, slug),
      languages: { "es-UY": rutaGuia("es", slugs.es), en: rutaGuia("en", slugs.en), "pt-BR": rutaGuia("pt", slugs.pt), "x-default": rutaGuia("es", slugs.es) },
    },
  };
}

export default async function GuiaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const guia = guiaPorSlug(locale, slug);
  if (!guia) {
    // El selector de idioma conserva el slug: se lleva a la traducción de la guía.
    const traduccion = traduccionDeGuia(slug, locale);
    if (traduccion) permanentRedirect(rutaGuia(locale, traduccion.slug));
    notFound();
  }
  const t = await getTranslations("guidesPage");
  const url = absoluteUrl(rutaGuia(locale, guia.slug));
  const datos = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: guia.tituloSeo,
        description: guia.descripcion,
        inLanguage: idiomaSchema[locale],
        url,
        mainEntityOfPage: url,
        author: { "@type": "Organization", name: "MateArte Uruguay", url: absoluteUrl() },
        publisher: { "@type": "Organization", name: "MateArte Uruguay", url: absoluteUrl() },
      },
      ...(guia.faq.length
        ? [{ "@type": "FAQPage", "@id": `${url}#faq`, mainEntity: guia.faq.map((f) => ({ "@type": "Question", name: f.pregunta, acceptedAnswer: { "@type": "Answer", text: sinMarcas(f.respuesta) } })) }]
        : []),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("home"), item: absoluteUrl(localizedPathname(locale, "/")) },
          { "@type": "ListItem", position: 2, name: t("title"), item: absoluteUrl(localizedPathname(locale, "/guias")) },
          { "@type": "ListItem", position: 3, name: guia.titulo, item: url },
        ],
      },
    ],
  };
  return (
    <>
      <JsonLd data={datos} />
      <GuiaDetalle guia={guia} />
    </>
  );
}
