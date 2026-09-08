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
  { src: `${desktopAssets}/personalizado-01.jpg`, alt: "gallery1" },
  { src: `${desktopAssets}/personalizado-02.jpg`, alt: "gallery2" },
  { src: `${desktopAssets}/personalizado-03.jpg`, alt: "gallery3" },
  { src: `${desktopAssets}/personalizado-04.jpg`, alt: "gallery4" },
  { src: `${desktopAssets}/personalizado-05.jpg`, alt: "gallery5" },
  { src: `${desktopAssets}/personalizado-06.jpg`, alt: "gallery6" },
  { src: `${desktopAssets}/personalizado-07.jpg`, alt: "gallery7" },
  { src: `${desktopAssets}/personalizado-08.jpg`, alt: "gallery8" },
  { src: `${desktopAssets}/personalizado-09.jpg`, alt: "gallery9" },
  { src: `${desktopAssets}/personalizado-10.jpg`, alt: "gallery10" },
  { src: `${desktopAssets}/personalizado-11.jpg`, alt: "gallery11" },
  { src: `${desktopAssets}/personalizado-12.jpg`, alt: "gallery12" },
  { src: `${desktopAssets}/personalizado-13.jpg`, alt: "gallery13" },
] as const;

const mobilePersonalizedGallery = [
  { src: `${mobileAssets}/personalizado-01.jpg`, alt: "gallery1" },
  { src: `${mobileAssets}/personalizado-02.jpg`, alt: "gallery2" },
  { src: `${mobileAssets}/personalizado-03.jpg`, alt: "gallery3" },
  { src: `${mobileAssets}/personalizado-04.jpg`, alt: "gallery4" },
  { src: `${mobileAssets}/personalizado-05.jpg`, alt: "gallery5" },
  { src: `${mobileAssets}/personalizado-06.jpg`, alt: "gallery6" },
  { src: `${mobileAssets}/personalizado-07.jpg`, alt: "gallery7" },
  { src: `${mobileAssets}/personalizado-08.jpg`, alt: "gallery8" },
  { src: `${mobileAssets}/personalizado-09.jpg`, alt: "gallery9" },
  { src: `${mobileAssets}/personalizado-10.jpg`, alt: "gallery10" },
  { src: `${mobileAssets}/personalizado-11.jpg`, alt: "gallery11" },
  { src: `${mobileAssets}/personalizado-12.jpg`, alt: "gallery12" },
  { src: `${mobileAssets}/personalizado-13.jpg`, alt: "gallery13" },
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
            src={`${mobileAssets}/hero1.jpg`}
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
            src={`${desktopAssets}/hero1.jpg`}
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
      <section id="empresas" className="personalizados-empresas" aria-label="Empresas que confiaron en nosotros">
        <h2>Empresas que confiaron en nosotros</h2>
        <div className="personalizados-empresas-viewport">
          <div className="personalizados-empresas-track">
            {[false, true].map((duplicate) => (
              <div
                className="personalizados-empresas-group"
                aria-hidden={duplicate || undefined}
                key={duplicate ? "duplicate" : "original"}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <figure className="personalizados-empresas-card" key={`${duplicate ? "duplicate" : "original"}-${num}`}>
                    <Image src={`/assets/matearte/regalos-empresariales/${num}.jpeg`} alt={`Empresa ${num}`} fill sizes="200px" />
                  </figure>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
