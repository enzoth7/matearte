import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { CatalogDesktop } from "@/components/CatalogDesktop";
import { CatalogMobile } from "@/components/CatalogMobile";
import { JsonLd } from "@/components/JsonLd";
import { localizedAlternates, localizedPageMetadata } from "@/i18n/metadata";
import { isCategoryPageSlug } from "@/lib/catalog-filters";
import { buildCatalogStructuredData } from "@/lib/seo";
import { getStorefrontProducts, getExchangeRates } from "@/lib/storefront-catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("catalog");
  const metadata = localizedPageMetadata(locale, "/catalogo", t("metadataTitle"), t("metadataDescription"));
  // /catalogo?categoria=mates muestra lo mismo que /catalogo/mates: esa es la URL principal.
  const categoria = (await searchParams).categoria;
  if (typeof categoria === "string" && isCategoryPageSlug(categoria)) {
    const href = { pathname: "/catalogo/[categoria]" as const, params: { categoria } };
    return { ...metadata, alternates: localizedAlternates(locale, href) };
  }
  return metadata;
}

export default async function CatalogPage() {
  const locale = await getLocale();
  const t = await getTranslations("catalog");
  const products = await getStorefrontProducts(locale);
  const exchangeRates = await getExchangeRates();
  return (
    <main id="contenido" className="catalog-page">
      <JsonLd data={buildCatalogStructuredData(locale, products, t("metadataTitle"), t("metadataDescription"), "MateArte")} />
      <div className="catalog-desktop-view">
        <section className="catalog-hero">
          <Image src="/assets/matearte/catalog-desktop/hero.png" alt={t("heroAlt")} fill sizes="100vw" priority />
          <div className="catalog-hero-overlay" />
          <div className="catalog-hero-content">
            <h1>{t("heroTitle")}</h1>
            <p>{t("heroBody")}</p>
          </div>
        </section>
        <Suspense fallback={<div className="catalog-desktop-loading">{t("loading")}</div>}>
          <CatalogDesktop products={products} exchangeRates={exchangeRates} />
        </Suspense>
      </div>

      <div className="catalog-mobile-view">
        <Suspense fallback={<div className="catalog-mobile-loading">{t("loading")}</div>}>
          <CatalogMobile products={products} exchangeRates={exchangeRates} />
        </Suspense>
      </div>
    </main>
  );
}
