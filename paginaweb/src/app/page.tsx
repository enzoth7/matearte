import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeFeaturedProducts } from "@/components/home/HomeFeaturedProducts";
import { StorefrontAnnouncement } from "@/components/StorefrontAnnouncement";
import { JsonLd } from "@/components/JsonLd";
import { Link } from "@/i18n/navigation";
import { localizedOpenGraph } from "@/i18n/metadata";
import { buildSiteStructuredData } from "@/lib/seo";

const assets = "/assets/matearte/home-v2";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("metadata");
  const image = {
    url: "/assets/matearte/og/matearte-portada-og.jpg",
    width: 1200,
    height: 630,
    alt: locale === "en"
      ? "MateArte's selection of handcrafted Uruguayan mate gourds"
      : locale === "pt"
        ? "Seleção de cuias artesanais uruguaias da MateArte"
        : "Selección de mates artesanales uruguayos de MateArte",
  };

  return {
    openGraph: localizedOpenGraph(locale, "/", t("title"), t("openGraphDescription"), image),
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("twitterDescription"),
      images: [image],
    },
  };
}

const categories = [
  { name: "categoryMates", copy: "categoryMatesCopy", image: "category-mates.webp", category: "mates" },
  { name: "categoryBombillas", copy: "categoryBombillasCopy", image: "category-bombillas.webp", category: "bombillas" },
  { name: "categoryMateras", copy: "categoryMaterasCopy", image: "category-materas.webp", category: "materas" },
  { name: "categoryTermos", copy: "categoryTermosCopy", image: "category-termos.webp", category: "termos" },
  { name: "categoryGifts", copy: "categoryGiftsCopy", image: "category-regalos.webp", category: "regalos" },
] as const;

const champions = [
  { name: "Darwin Núñez", image: "darwin.webp" },
  { name: "Federico Valverde", image: "valverde.webp" },
  { name: "José M. Giménez", image: "gimenez.webp" },
] as const;

function BandContent({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={className} data-scroll-reveal style={{ transitionDelay: `${delay}s` }}>{children}</div>;
}

export default async function Home() {
  const locale = await getLocale();
  const t = await getTranslations("home");
  const metadata = await getTranslations("metadata");
  return (
    <main id="contenido" className="home-page">
      <StorefrontAnnouncement />
      <JsonLd data={buildSiteStructuredData(locale, metadata("description"))} />
      <HomeHero />

      <HomeFeaturedProducts />

      <section className="home-section home-scroll-band home-craft">
        <div className="home-shell home-craft-grid">
          <BandContent className="home-copy-block">
            <h2 className="home-craft-title">{t("craftTitleTop")} {t("craftTitleMiddle")} {t("craftTitleMate")}</h2>
            <div data-copy className="home-craft-subtitle">{t("craftSubtitle")}</div>
            <div data-copy className="home-craft-body-desktop">{t("craftDesktop")}</div>
            <div data-copy className="home-craft-intro-mobile">{t("craftIntroMobile")}</div>
            <div data-copy className="home-craft-body-mobile">{t("craftMobile")}</div>
          </BandContent>
          <div className="home-craft-gallery">
            <BandContent className="home-image home-craft-image" delay={0.06}>
              <Image src={`${assets}/craft-hands.webp`} alt={t("craftHandsAlt")} fill sizes="(max-width: 768px) 50vw, 28vw" />
            </BandContent>
            <BandContent className="home-image home-craft-image" delay={0.12}>
              <Image src={`${assets}/craft-leather.webp`} alt={t("craftLeatherAlt")} fill sizes="(max-width: 768px) 50vw, 28vw" />
            </BandContent>
          </div>
        </div>
      </section>

      <section className="home-section home-scroll-band home-history">
        <div className="home-shell home-history-grid">
          <BandContent className="home-image home-history-image">
            <Image src={`${assets}/history.webp`} alt={t("historyAlt")} fill sizes="(max-width: 768px) 100vw, 44vw" />
          </BandContent>
          <BandContent className="home-history-copy" delay={0.08}>
            <h2 className="home-history-title"><strong>{t("historyYears")}</strong><strong>{t("historyTradition")}</strong><strong data-inline>{t("historyGeneration")}</strong></h2>
            <div data-copy className="home-history-body-desktop">{t("historyDesktop")}</div>
            <div data-copy className="home-history-body-mobile">{t("historyMobile")}</div>
            <Link className="home-button home-button-dark" href="/nosotros">{t("historyAction")}</Link>
          </BandContent>
        </div>
      </section>

      <section className="home-section home-scroll-band home-categories">
        <div className="home-shell">
          <BandContent className="home-section-intro home-section-intro-center">
            <h2>{t("chooseTitle")}</h2>
            <div data-copy>{t("chooseBody")}</div>
          </BandContent>
          <div className="home-category-grid">
            {categories.map((category, index) => (
              <BandContent key={category.name} className={"home-category-wrap home-category-wrap-" + (index + 1)} delay={Math.min(index * 0.05, 0.2)}>
                <Link
                  className="home-category-card"
                  href={category.category === "regalos"
                    ? "/empresas"
                    : { pathname: "/catalogo/[categoria]", params: { categoria: category.category } }}
                >
                  <div className="home-image home-category-image">
                    <Image src={`${assets}/${category.image}`} alt={t(category.name)} fill sizes="(max-width: 768px) 50vw, 20vw" />
                  </div>
                  <div className="home-category-copy"><h3>{t(category.name)}</h3><div data-copy>{t(category.copy)}</div></div>
                </Link>
              </BandContent>
            ))}
          </div>
          <div className="home-center-action"><Link className="home-button home-button-dark" href="/catalogo">{t("viewCatalog")}</Link></div>
        </div>
      </section>

      <section className="home-section home-scroll-band home-personalized">
        <div className="home-shell home-personalized-grid">
          <BandContent className="home-image home-personalized-image"><Image src={`${assets}/personalizados.webp`} alt={t("customAlt")} fill sizes="(max-width: 768px) 100vw, 48vw" /></BandContent>
          <BandContent className="home-personalized-copy" delay={0.08}>
            <h2>{t("customTitle")}</h2>
            <div data-copy>{t("customBody")}</div>
            <Link className="home-button home-button-light" href="/personalizados">{t("customAction")}</Link>
          </BandContent>
        </div>
      </section>

      <section className="home-section home-scroll-band home-champions">
        <div className="home-champions-shell">
          <BandContent className="home-champions-intro">
            <h2>{t("championsTitle")}</h2>
            <div data-copy className="home-champions-copy-desktop">{t("championsDesktop")}</div>
            <div data-copy className="home-champions-copy-mobile">{t("championsMobile")}</div>
          </BandContent>
          <div className="home-champions-grid" tabIndex={0} aria-label={t("championsGallery")}>
            {champions.map((champion, index) => (
              <BandContent key={champion.name} className="home-champion" delay={index * 0.07}>
                <div className="home-image home-champion-image"><Image src={`${assets}/${champion.image}`} alt={t("championAlt", { name: champion.name })} fill sizes="(max-width: 768px) 244px, 390px" loading="eager" unoptimized /></div>
                <h3>{champion.name}</h3>
              </BandContent>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-scroll-band home-imperial">
        <div className="home-shell home-imperial-grid">
          <BandContent className="home-image home-imperial-image"><Image src={`${assets}/mate-imperial.webp`} alt={t("imperialAlt")} fill sizes="(max-width: 768px) 100vw, 42vw" /></BandContent>
          <BandContent className="home-imperial-copy" delay={0.08}>
            <h2>{t("imperialTitle")}</h2>
            <h3>{t("imperialSubtitle")}</h3>
            <div data-copy>{t("imperialBody1")}</div>
            <div data-copy>{t("imperialBody2")}</div>
          </BandContent>
        </div>
      </section>

      <section className="home-section home-scroll-band home-culture">
        <div className="home-shell home-culture-grid">
          <BandContent className="home-culture-copy">
            <h2><strong data-inline>{t("cultureLine1")}</strong><strong data-inline>{t("cultureLine2")}</strong></h2>
            <div data-copy>{t("cultureBody")}</div>
            <Image src={`${assets}/uruguay.webp`} alt={t("countryAlt")} width={392} height={180} className="home-country-logo" />
          </BandContent>
          <BandContent className="home-image home-culture-image" delay={0.08}><Image src={`${assets}/culture.webp`} alt={t("cultureAlt")} fill sizes="(max-width: 768px) 100vw, 43vw" /></BandContent>
        </div>
      </section>

      <section className="home-section home-scroll-band home-visit">
        <div className="home-shell home-visit-grid">
          <BandContent className="home-image home-visit-image"><Image src={`${assets}/store.webp`} alt={t("storeAlt")} fill sizes="(max-width: 768px) 100vw, 44vw" /></BandContent>
          <BandContent className="home-visit-copy" delay={0.08}>
            <h2>{t("visitTitle")}</h2>
            <div data-copy>25 de Mayo 1734, <strong data-inline className="home-address-place">Paysandú, Uruguay</strong></div>
            <a className="home-button home-button-light" href="https://www.google.com/maps/search/?api=1&query=25+de+Mayo+1734+Paysandu+Uruguay" target="_blank" rel="noreferrer">{t("mapsAction")}</a>
            <div className="home-shipping">
              <h2><strong data-inline>{t("shippingLine1")}</strong><strong data-inline>{t("shippingLine2")}</strong></h2>
              <div data-copy>{t("shippingBody")}</div>
              <Link className="home-button home-button-light" href="/contacto">{t("contactAction")}</Link>
            </div>
          </BandContent>
        </div>
      </section>

    </main>
  );
}
