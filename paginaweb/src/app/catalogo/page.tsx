import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { CatalogDesktop } from "@/components/CatalogDesktop";
import { CatalogMobile } from "@/components/CatalogMobile";
import { JsonLd } from "@/components/JsonLd";
import { localizedPageMetadata } from "@/i18n/metadata";
import { buildCatalogStructuredData } from "@/lib/seo";
import { getStorefrontProducts, getExchangeRates } from "@/lib/storefront-catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("catalog");
  return localizedPageMetadata(locale, "/catalogo", t("metadataTitle"), t("metadataDescription"));
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
