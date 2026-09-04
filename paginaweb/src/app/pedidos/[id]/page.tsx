import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { OrderStatus } from "@/components/OrderStatus";
import { localizedAlternates } from "@/i18n/metadata";
import type { Locale } from "@/types/catalog";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, locale, t] = await Promise.all([params, getLocale() as Promise<Locale>, getTranslations("order")]);
  return { title: t("metadataTitle"), alternates: localizedAlternates(locale, { pathname: "/pedidos/[id]", params: { id } }), robots: { index: false, follow: false } };
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("order");
  return (
    <main id="contenido" className="order-detail-page pb-24 pt-8 sm:pb-32 sm:pt-12">
      <div className="order-detail-shell container-shell">
        <div className="order-detail-card">
          <header className="order-detail-desktop-header">
            <h1 id="order-detail-title">{t("title")}</h1>
            <p>{t("intro")}</p>
          </header>
          <div className="order-detail-content"><OrderStatus orderId={id} /></div>
        </div>
      </div>
    </main>
  );
}
