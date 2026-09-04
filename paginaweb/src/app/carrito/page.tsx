import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CartPanel } from "@/components/CartPanel";
import { localizedAlternates } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("cart");
  return { title: t("metadataTitle"), alternates: localizedAlternates(locale, "/carrito"), robots: { index: false, follow: false } };
}

export default async function CarritoPage() {
  const t = await getTranslations("cart");
  return (
    <main id="contenido" className="cart-page pb-24 pt-8 sm:pb-32 sm:pt-12">
      <div className="cart-page-shell container-shell">
        <section className="cart-page-card overflow-hidden border border-black/15 bg-[var(--paper)] shadow-[var(--shadow-soft)]" aria-labelledby="cart-title">
          <div className="cart-page-rule h-1.5 bg-[var(--leather)]" aria-hidden="true" />
          <header className="cart-page-header p-6 sm:p-8 lg:px-10 lg:py-9">
            <p className="cart-page-eyebrow eyebrow text-[var(--leather)]">{t("eyebrow")}</p>
            <h1 id="cart-title" className="display-font mt-5 text-5xl font-medium tracking-[-0.03em] sm:text-6xl">{t("title")}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-black/60 sm:text-base">
              {t("intro")}
            </p>
          </header>
          <div className="cart-page-content border-t border-black/10">
            <CartPanel />
          </div>
        </section>
      </div>
    </main>
  );
}
