import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CatalogDesktop } from "@/components/CatalogDesktop";
import { CatalogMobile } from "@/components/CatalogMobile";
import { JsonLd } from "@/components/JsonLd";
import { categorySeo } from "@/content/category-seo";
import { localizedPageMetadata } from "@/i18n/metadata";
import { isCategoryPageSlug, productInCategory } from "@/lib/catalog-filters";
import { buildCategoryStructuredData } from "@/lib/seo";
import { getStorefrontProducts, getExchangeRates } from "@/lib/storefront-catalog";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ categoria: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { categoria } = await params;
  if (!isCategoryPageSlug(categoria)) return {};
  const locale = await getLocale();
  const copy = categorySeo[categoria][locale];
  return localizedPageMetadata(locale, { pathname: "/catalogo/[categoria]", params: { categoria } }, copy.title, copy.intro);
}

export default async function CategoryPage({ params }: Params) {
  const { categoria } = await params;
  if (!isCategoryPageSlug(categoria)) notFound();
  const locale = await getLocale();
  const t = await getTranslations("catalog");
  const products = await getStorefrontProducts(locale);
  const categoryProducts = products.filter((product) => productInCategory(product, categoria));
  // Una categoría sin productos publicados no tiene página: sería una página vacía para Google.
  if (categoryProducts.length === 0) notFound();
  const exchangeRates = await getExchangeRates();
  const copy = categorySeo[categoria][locale];

  return (
    <main id="contenido" className="catalog-page">
      <JsonLd data={buildCategoryStructuredData(locale, categoria, categoryProducts, copy.heading, copy.intro, t("metadataTitle"), "MateArte")} />
      <div className="catalog-desktop-view">
        <section className="catalog-hero">
          <Image src="/assets/matearte/catalog-desktop/hero.png" alt={t("heroAlt")} fill sizes="100vw" priority />
          <div className="catalog-hero-overlay" />
          <div className="catalog-hero-content">
            <h1>{copy.heading}</h1>
            <p>{copy.intro}</p>
          </div>
        </section>
        <Suspense fallback={<div className="catalog-desktop-loading">{t("loading")}</div>}>
          <CatalogDesktop products={products} exchangeRates={exchangeRates} pageCategory={categoria} />
        </Suspense>
      </div>

      <div className="catalog-mobile-view">
        <Suspense fallback={<div className="catalog-mobile-loading">{t("loading")}</div>}>
          <CatalogMobile products={products} exchangeRates={exchangeRates} pageCategory={categoria} heading={copy.heading} intro={copy.intro} />
        </Suspense>
      </div>
    </main>
  );
}
