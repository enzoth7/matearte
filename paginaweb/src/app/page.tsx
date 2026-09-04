import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { HomeHero } from "@/components/home/HomeHero";
import { JsonLd } from "@/components/JsonLd";
import { Link } from "@/i18n/navigation";
import { buildSiteStructuredData } from "@/lib/seo";

const assets = "/assets/matearte/home-v2";

const categories = [
  { name: "categoryMates", copy: "categoryMatesCopy", image: "category-mates.png", category: "mates" },
  { name: "categoryBombillas", copy: "categoryBombillasCopy", image: "category-bombillas.png", category: "bombillas" },
  { name: "categoryMateras", copy: "categoryMaterasCopy", image: "category-materas.png", category: "materas" },
  { name: "categoryTermos", copy: "categoryTermosCopy", image: "category-termos.png", category: "termos" },
  { name: "categoryGifts", copy: "categoryGiftsCopy", image: "category-regalos.png", category: "regalos" },
] as const;

const champions = [
  { name: "Darwin Núñez", image: "darwin.png" },
  { name: "Federico Valverde", image: "valverde.png" },
  { name: "José M. Giménez", image: "gimenez.png" },
] as const;

function BandContent({ children, className = "" }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={className}>{children}</div>;
}

export default async function Home() {
  const locale = await getLocale();
  const t = await getTranslations("home");
  const metadata = await getTranslations("metadata");
  return (
    <main id="contenido" className="home-page">
      <JsonLd data={buildSiteStructuredData(locale, metadata("description"))} />
      <HomeHero />

      <section className="home-section home-scroll-band home-craft">
        <div className="home-shell home-craft-grid">
          <BandContent className="home-copy-block">
            <h2 className="home-craft-title"><strong>{t("craftTitleTop")}</strong><span>{t("craftTitleMiddle")} <strong>{t("craftTitleMate")}</strong></span></h2>
            <p className="home-craft-subtitle">{t("craftSubtitle")}</p>
            <p className="home-craft-body-desktop">{t("craftDesktop")}</p>
            <p className="home-craft-intro-mobile">{t("craftIntroMobile")}</p>
            <p className="home-craft-body-mobile">{t("craftMobile")}</p>
          </BandContent>
          <div className="home-craft-gallery">
            <BandContent className="home-image home-craft-image" delay={0.06}>
              <Image src={`${assets}/craft-hands.png`} alt={t("craftHandsAlt")} fill sizes="(max-width: 768px) 50vw, 28vw" />
            </BandContent>
            <BandContent className="home-image home-craft-image" delay={0.12}>
              <Image src={`${assets}/craft-leather.png`} alt={t("craftLeatherAlt")} fill sizes="(max-width: 768px) 50vw, 28vw" />
            </BandContent>
          </div>
        </div>
      </section>

      <section className="home-section home-scroll-band home-history">
        <div className="home-shell home-history-grid">
          <BandContent className="home-image home-history-image">
            <Image src={`${assets}/history.png`} alt={t("historyAlt")} fill sizes="(max-width: 768px) 100vw, 44vw" />
          </BandContent>
          <BandContent className="home-history-copy" delay={0.08}>
            <h2 className="home-history-title"><strong>{t("historyYears")}</strong><strong>{t("historyTradition")}</strong><span>{t("historyGeneration")}</span></h2>
            <p className="home-history-body-desktop">{t("historyDesktop")}</p>
            <p className="home-history-body-mobile">{t("historyMobile")}</p>
            <Link className="home-button home-button-dark" href="/nosotros">{t("historyAction")}</Link>
          </BandContent>
        </div>
      </section>

      <section className="home-section home-scroll-band home-categories">
        <div className="home-shell">
          <BandContent className="home-section-intro home-section-intro-center">
            <h2>{t("chooseTitle")}</h2>
            <p>{t("chooseBody")}</p>
          </BandContent>
          <div className="home-category-grid">
            {categories.map((category, index) => (
              <BandContent key={category.name} className={"home-category-wrap home-category-wrap-" + (index + 1)} delay={Math.min(index * 0.05, 0.2)}>
                <Link className="home-category-card" href={{ pathname: "/catalogo", query: { categoria: category.category } }}>
                  <div className="home-image home-category-image">
                    <Image src={`${assets}/${category.image}`} alt={t(category.name)} fill sizes="(max-width: 768px) 50vw, 20vw" />
                  </div>
                  <div className="home-category-copy"><h3>{t(category.name)}</h3><p>{t(category.copy)}</p></div>
                </Link>
              </BandContent>
            ))}
          </div>
          <div className="home-center-action"><Link className="home-button home-button-dark" href="/catalogo">{t("viewCatalog")}</Link></div>
        </div>
      </section>

      <section className="home-section home-scroll-band home-personalized">
        <div className="home-shell home-personalized-grid">
          <BandContent className="home-image home-personalized-image"><Image src={`${assets}/personalizados.png`} alt={t("customAlt")} fill sizes="(max-width: 768px) 100vw, 48vw" /></BandContent>
          <BandContent className="home-personalized-copy" delay={0.08}>
            <h2>{t("customTitle")}</h2>
            <p>{t("customBody")}</p>
            <Link className="home-button home-button-light" href="/personalizados">{t("customAction")}</Link>
          </BandContent>
        </div>
      </section>

      <section className="home-section home-scroll-band home-champions">
        <div className="home-champions-shell">
          <BandContent className="home-champions-intro">
            <h2>{t("championsTitle")}</h2>
            <p className="home-champions-copy-desktop">{t("championsDesktop")}</p>
            <p className="home-champions-copy-mobile">{t("championsMobile")}</p>
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
          <BandContent className="home-image home-imperial-image"><Image src={`${assets}/mate-imperial.png`} alt={t("imperialAlt")} fill sizes="(max-width: 768px) 100vw, 42vw" /></BandContent>
          <BandContent className="home-imperial-copy" delay={0.08}>
            <h2>{t("imperialTitle")}</h2>
            <h3>{t("imperialSubtitle")}</h3>
            <p>{t("imperialBody1")}</p>
            <p>{t("imperialBody2")}</p>
          </BandContent>
        </div>
      </section>

      <section className="home-section home-scroll-band home-culture">
        <div className="home-shell home-culture-grid">
          <BandContent className="home-culture-copy">
            <h2><span>{t("cultureLine1")}</span><span>{t("cultureLine2")}</span></h2>
            <p>{t("cultureBody")}</p>
            <Image src={`${assets}/uruguay.png`} alt={t("countryAlt")} width={392} height={180} className="home-country-logo" />
          </BandContent>
          <BandContent className="home-image home-culture-image" delay={0.08}><Image src={`${assets}/culture.png`} alt={t("cultureAlt")} fill sizes="(max-width: 768px) 100vw, 43vw" /></BandContent>
        </div>
      </section>

      <section className="home-section home-scroll-band home-visit">
        <div className="home-shell home-visit-grid">
          <BandContent className="home-image home-visit-image"><Image src={`${assets}/store.png`} alt={t("storeAlt")} fill sizes="(max-width: 768px) 100vw, 44vw" /></BandContent>
          <BandContent className="home-visit-copy" delay={0.08}>
            <h2>{t("visitTitle")}</h2>
            <p>25 de Mayo 1734 · <span className="home-address-place">Paysandú, Uruguay</span></p>
            <a className="home-button home-button-light" href="https://www.google.com/maps/search/?api=1&query=25+de+Mayo+1734+Paysandu+Uruguay" target="_blank" rel="noreferrer">{t("mapsAction")}</a>
            <div className="home-shipping">
              <h2><span>{t("shippingLine1")}</span><span>{t("shippingLine2")}</span></h2>
              <p>{t("shippingBody")}</p>
              <Link className="home-button home-button-light" href="/contacto">{t("contactAction")}</Link>
            </div>
          </BandContent>
        </div>
      </section>

    </main>
  );
}
