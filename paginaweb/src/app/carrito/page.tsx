import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import styles from "@/components/Cart.module.css";
import { toCartCatalog } from "@/lib/cart-recommendations";
import type { Locale } from "@/types/catalog";
import { CartPanel } from "@/components/CartPanel";
import { localizedAlternates } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("cart");
  return { title: t("metadataTitle"), alternates: localizedAlternates(locale, "/carrito"), robots: { index: false, follow: false } };
}

export default async function CarritoPage() {
  const t = await getTranslations("cart");
  const { getExchangeRates, getWholesaleDiscountSettings, getStorefrontProducts } = await import("@/lib/storefront-catalog");
  const locale = await getLocale() as Locale;
  const [exchangeRates, wholesaleSettings, products] = await Promise.all([getExchangeRates(), getWholesaleDiscountSettings(), getStorefrontProducts(locale)]);
  return (
    <main id="contenido" data-clarity-mask="true" className={styles.page}>
      <header className={styles.header}>
        <h1 id="cart-title">{t("title")}</h1>
        <div>{t("intro")}</div>
      </header>
      <CartPanel exchangeRates={exchangeRates} wholesaleSettings={wholesaleSettings} catalog={toCartCatalog(products)} />
    </main>
  );
}
