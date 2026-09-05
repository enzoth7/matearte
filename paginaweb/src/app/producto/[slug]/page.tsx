import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ProductDesktop } from "@/components/ProductDesktop";
import { ProductMobile } from "@/components/ProductMobile";
import { localizedPageMetadata } from "@/i18n/metadata";
import { buildProductStructuredData, productSeoCopy } from "@/lib/seo";
import { getStorefrontProduct, getExchangeRates } from "@/lib/storefront-catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const product = await getStorefrontProduct(slug, locale);
  if (!product) return {};
  const seo = productSeoCopy(product, locale);
  return localizedPageMetadata(
    locale,
    { pathname: "/producto/[slug]", params: { slug: product.slug } },
    seo.title,
    seo.description,
    {
      socialTitle: product.name,
      image: {
        url: product.images[0].src,
        width: product.images[0].width,
        height: product.images[0].height,
        alt: product.images[0].alt,
      },
    },
  );
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const product = await getStorefrontProduct(slug, locale);
  const exchangeRates = await getExchangeRates();
  if (!product) notFound();
  const catalog = await getTranslations("catalog");
  const schema = buildProductStructuredData(locale, product, catalog("metadataTitle"), "MateArte");
  return (
    <main id="contenido" className="product-page">
      <JsonLd data={schema} />
      <div className="product-desktop-view">
        <ProductDesktop product={product} exchangeRates={exchangeRates} />
      </div>
      <div className="product-mobile-view">
        <ProductMobile product={product} exchangeRates={exchangeRates} />
      </div>
    </main>
  );
}
