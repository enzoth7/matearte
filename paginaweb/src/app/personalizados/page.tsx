import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { localizedPageMetadata } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { buildPageStructuredData } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("customPage");
  return localizedPageMetadata(locale, "/personalizados", t("metadataTitle"), t("metadataDescription"));
}

const desktopAssets = "/assets/matearte/personalizados-desktop";
const mobileAssets = "/assets/matearte/personalizados-mobile";

const personalizedGallery = [
  { src: `${desktopAssets}/personalizado-01.png`, alt: "gallery1" },
  { src: `${desktopAssets}/personalizado-03.png`, alt: "gallery3" },
  { src: `${desktopAssets}/personalizado-04.png`, alt: "gallery4" },
  { src: `${desktopAssets}/personalizado-07.png`, alt: "gallery7" },
  { src: `${desktopAssets}/personalizado-08.png`, alt: "gallery8" },
  { src: `${desktopAssets}/personalizado-09.png`, alt: "gallery5" },
  { src: `${desktopAssets}/personalizado-10.png`, alt: "gallery10" },
] as const;

const mobilePersonalizedGallery = [
  { src: `${mobileAssets}/personalizado-01.png`, alt: "gallery1" },
  { src: `${mobileAssets}/personalizado-02.png`, alt: "gallery2" },
  { src: `${mobileAssets}/personalizado-03.png`, alt: "gallery3" },
  { src: `${mobileAssets}/personalizado-04.png`, alt: "gallery4" },
  { src: `${mobileAssets}/personalizado-05.png`, alt: "gallery5" },
  { src: `${mobileAssets}/personalizado-06.png`, alt: "gallery6" },
  { src: `${mobileAssets}/personalizado-07.png`, alt: "gallery7" },
  { src: `${mobileAssets}/personalizado-08.png`, alt: "gallery8" },
  { src: `${mobileAssets}/personalizado-09.png`, alt: "gallery9" },
  { src: `${mobileAssets}/personalizado-10.png`, alt: "gallery10" },
] as const;

export default async function PersonalizadosPage() {
  const locale = await getLocale();
  const t = await getTranslations("customPage");
  const customizerUrl = process.env.NEXT_PUBLIC_CUSTOMIZER_URL;
  return (
    <main id="contenido" className="personalizados-page">
      <JsonLd data={buildPageStructuredData({ locale, href: "/personalizados", name: t("metadataTitle"), description: t("metadataDescription"), homeLabel: "MateArte" })} />
      <div className="personalizados-mobile-view">
        <section className="personalizados-mobile-hero">
          <Image
            src={`${mobileAssets}/hero.png`}
            alt={t("heroAlt")}
            fill
            sizes="100vw"
            className="personalizados-mobile-hero-image"
            priority
          />
          <div className="personalizados-mobile-hero-tint" aria-hidden="true" />
          <div className="personalizados-mobile-hero-gradient" aria-hidden="true" />
          <div className="personalizados-mobile-hero-copy">
            <h1>{t("title")}</h1>
            <p>{t("body")}</p>
            {customizerUrl ? (
              <a href={customizerUrl} target="_blank" rel="noreferrer">{t("action")}</a>
            ) : (
              <Link href="/contacto">{t("action")}</Link>
            )}
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
          <h2>{t("craftTitle")}</h2>
          <p>{t("craftBody")}</p>
        </section>
      </div>

      <div className="personalizados-desktop-view">
        <section className="personalizados-desktop-hero">
          <Image
            src={`${desktopAssets}/hero.png`}
            alt={t("heroAlt")}
            fill
            sizes="100vw"
            className="personalizados-desktop-hero-image"
            priority
          />
          <div className="personalizados-desktop-hero-tint" aria-hidden="true" />
          <div className="personalizados-desktop-hero-gradient" aria-hidden="true" />
          <div className="personalizados-desktop-hero-copy">
            <h1>{t("title")}</h1>
            <p>{t("body")}</p>
            {customizerUrl ? (
              <a href={customizerUrl} target="_blank" rel="noreferrer">{t("action")}</a>
            ) : (
              <Link href="/contacto">{t("action")}</Link>
            )}
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
          <div className="personalizados-desktop-craft-grid">
          <h2>{t("craftTitle")}</h2>
            <div>
              <p>{t("craftBody")}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
