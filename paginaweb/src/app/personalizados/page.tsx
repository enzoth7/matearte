import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { localizedPageMetadata } from "@/i18n/metadata";
import { buildPageStructuredData } from "@/lib/seo";
import styles from "./PersonalizadosPage.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("customPage");
  return localizedPageMetadata(locale, "/personalizados", t("metadataTitle"), t("metadataDescription"), {
    image: {
      url: "/assets/matearte/og/matearte-personalizados-v2.jpg",
      width: 1200,
      height: 630,
      alt: t("heroAlt"),
    },
  });
}

const desktopAssets = "/assets/matearte/personalizados-desktop";
const mobileAssets = "/assets/matearte/personalizados-mobile";
const personalizerUrl = "https://personalizador.matearteuruguay.com/";

const personalizedGallery = [
  { src: `${desktopAssets}/personalizado-01.webp`, alt: "gallery1" },
  { src: `${desktopAssets}/personalizado-02.webp`, alt: "gallery2" },
  { src: `${desktopAssets}/personalizado-03.webp`, alt: "gallery3" },
  { src: `${desktopAssets}/personalizado-04.webp`, alt: "gallery4" },
  { src: `${desktopAssets}/personalizado-05.webp`, alt: "gallery5" },
  { src: `${desktopAssets}/personalizado-06.webp`, alt: "gallery6" },
  { src: `${desktopAssets}/personalizado-07.webp`, alt: "gallery7" },
  { src: `${desktopAssets}/personalizado-08.webp`, alt: "gallery8" },
  { src: `${desktopAssets}/personalizado-09.webp`, alt: "gallery9" },
  { src: `${desktopAssets}/personalizado-10.webp`, alt: "gallery10" },
  { src: `${desktopAssets}/personalizado-11.webp`, alt: "gallery11" },
  { src: `${desktopAssets}/personalizado-12.webp`, alt: "gallery12" },
  { src: `${desktopAssets}/personalizado-13.webp`, alt: "gallery13" },
] as const;

const mobilePersonalizedGallery = [
  { src: `${mobileAssets}/personalizado-01.webp`, alt: "gallery1" },
  { src: `${mobileAssets}/personalizado-02.webp`, alt: "gallery2" },
  { src: `${mobileAssets}/personalizado-03.webp`, alt: "gallery3" },
  { src: `${mobileAssets}/personalizado-04.webp`, alt: "gallery4" },
  { src: `${mobileAssets}/personalizado-05.webp`, alt: "gallery5" },
  { src: `${mobileAssets}/personalizado-06.webp`, alt: "gallery6" },
  { src: `${mobileAssets}/personalizado-07.webp`, alt: "gallery7" },
  { src: `${mobileAssets}/personalizado-08.webp`, alt: "gallery8" },
  { src: `${mobileAssets}/personalizado-09.webp`, alt: "gallery9" },
  { src: `${mobileAssets}/personalizado-10.webp`, alt: "gallery10" },
  { src: `${mobileAssets}/personalizado-11.webp`, alt: "gallery11" },
  { src: `${mobileAssets}/personalizado-12.webp`, alt: "gallery12" },
  { src: `${mobileAssets}/personalizado-13.webp`, alt: "gallery13" },
] as const;

export default async function PersonalizadosPage() {
  const locale = await getLocale();
  const t = await getTranslations("customPage");
  return (
    <main id="contenido" className={`personalizados-page ${styles.page}`}>
      <JsonLd data={buildPageStructuredData({ locale, href: "/personalizados", name: t("metadataTitle"), description: t("metadataDescription"), homeLabel: "MateArte" })} />
      <div className="personalizados-mobile-view">
        <section className="personalizados-mobile-hero">
          <Image
            src={`${desktopAssets}/personalizado-02.webp`}
            alt={t("heroAlt")}
            fill
            sizes="100vw"
            className="personalizados-mobile-hero-image"
            quality={95}
            priority
          />
          <div className="personalizados-mobile-hero-tint" aria-hidden="true" />
          <div className="personalizados-mobile-hero-gradient" aria-hidden="true" />
          <div className="personalizados-mobile-hero-copy">
            <h1>{t("title")}</h1>
            <div data-copy>{t("body")}</div>
            <a href={personalizerUrl} target="_blank" rel="noreferrer">{t("action")}</a>
          </div>
        </section>

        <section className="personalizados-mobile-gallery" aria-label={t("galleryLabel")}>
          <div className="personalizados-mobile-gallery-viewport">
            <div className="personalizados-mobile-gallery-track">
              {[false, true].map((duplicate) => (
                <div
                  className="personalizados-mobile-gallery-group"
                  aria-hidden={duplicate || undefined}
                  key={duplicate ? "duplicate" : "original"}
                >
                  {mobilePersonalizedGallery.map((image) => (
                    <figure className="personalizados-mobile-gallery-card" key={`${duplicate ? "duplicate" : "original"}-${image.src}`}>
                      <Image src={image.src} alt={duplicate ? "" : t(image.alt)} fill sizes="300px" />
                    </figure>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="personalizados-mobile-craft">
          <h2 data-scroll-reveal>{t("craftTitle")}</h2>
          <div data-copy data-scroll-reveal style={{ transitionDelay: "0.07s" }}>{t("craftBody")}</div>
        </section>
      </div>

      <div className="personalizados-desktop-view">
        <section className="personalizados-desktop-hero">
          <Image
            src={`${desktopAssets}/personalizado-02.webp`}
            alt={t("heroAlt")}
            fill
            sizes="100vw"
            className="personalizados-desktop-hero-image"
            quality={95}
            priority
          />
          <div className="personalizados-desktop-hero-tint" aria-hidden="true" />
          <div className="personalizados-desktop-hero-gradient" aria-hidden="true" />
          <div className="personalizados-desktop-hero-copy">
            <h1>{t("title")}</h1>
            <div data-copy>{t("body")}</div>
            <a href={personalizerUrl} target="_blank" rel="noreferrer">{t("action")}</a>
          </div>
        </section>

        <section className="personalizados-desktop-gallery" aria-label={t("galleryLabel")}>
          <div className="personalizados-desktop-gallery-viewport">
            <div className="personalizados-desktop-gallery-track">
              {[false, true].map((duplicate) => (
                <div
                  className="personalizados-desktop-gallery-group"
                  aria-hidden={duplicate || undefined}
                  key={duplicate ? "duplicate" : "original"}
                >
                  {personalizedGallery.map((image) => (
                    <figure className="personalizados-desktop-gallery-card" key={`${duplicate ? "duplicate" : "original"}-${image.src}`}>
                      <Image src={image.src} alt={duplicate ? "" : t(image.alt)} fill sizes="320px" />
                    </figure>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="personalizados-desktop-craft">
          <div className="personalizados-desktop-craft-grid" data-scroll-reveal>
          <h2>{t("craftTitle")}</h2>
            <div>
              <div data-copy>{t("craftBody")}</div>
            </div>
          </div>
        </section>
      </div>

      <section className={styles.process} aria-labelledby="personalizados-steps-title">
        <div className={styles.processInner}>
          <figure className={styles.processPhoto}>
            <Image
              src="/assets/matearte/og/matearte-personalizados-v2.jpg"
              alt={t("processAlt")}
              fill
              quality={95}
              // Account for the landscape photo cropped into the portrait frame.
              sizes="(min-width: 1024px) 1220px, calc(218vw - 105px)"
            />
          </figure>
          <div className={styles.processCopy}>
            <h2 id="personalizados-steps-title">{t("stepsTitle")}</h2>
            <ol className={styles.processSteps} role="list">
              <li><h3>{t("stepOneTitle")}</h3><div>{t("stepOneBody")}</div></li>
              <li><h3>{t("stepTwoTitle")}</h3><div>{t("stepTwoBody")}</div></li>
              <li><h3>{t("stepThreeTitle")}</h3><div>{t("stepThreeBody")}</div></li>
            </ol>
            <a className={styles.processAction} href={personalizerUrl} target="_blank" rel="noreferrer">{t("action")}</a>
          </div>
        </div>
      </section>
    </main>
  );
}
