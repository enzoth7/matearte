import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { NosotrosHero } from "@/components/NosotrosHero";
import { localizedPageMetadata } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { buildPageStructuredData } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("aboutPage");
  return localizedPageMetadata(locale, "/nosotros", t("metadataTitle"), t("metadataDescription"));
}

const mobileChapters = [
  {
    title: "originTitle",
    year: "originYear",
    body: "originBody",
    image: "/assets/matearte/nosotros-desktop/origen.png",
    imageClass: "nosotros-mobile-chapter-image-origin",
    alt: "originAlt",
  },
  {
    title: "riverTitle",
    year: "riverYear",
    body: "riverBody",
    image: "/assets/matearte/nosotros-desktop/dos-orillas.png",
    imageClass: "nosotros-mobile-chapter-image-river",
    alt: "riverAlt",
  },
  {
    title: "brandTitle",
    year: "brandYear",
    body: "brandBody",
    image: "/assets/matearte/01-marca/Logo1254.png",
    imageClass: "nosotros-mobile-chapter-image-brand",
    alt: "brandAlt",
  },
] as const;

export default async function NosotrosPage() {
  const locale = await getLocale();
  const t = await getTranslations("aboutPage");
  return (
    <main id="contenido" className="nosotros-page">
      <JsonLd data={buildPageStructuredData({ locale, href: "/nosotros", name: t("metadataTitle"), description: t("metadataDescription"), type: "AboutPage", homeLabel: "MateArte", includeOrganization: true })} />
      <div className="nosotros-desktop">
        <NosotrosHero />

        <section className="nosotros-desktop-story" aria-labelledby="nosotros-story-title">
          <header className="nosotros-desktop-story-intro">
            <h2 id="nosotros-story-title">
              <span>{t("storyLine1")}</span>
              <span>{t("storyLine2")}</span>
            </h2>
          </header>

          <div className="nosotros-desktop-reveal">
            <article className="nosotros-desktop-chapter">
              <div className="nosotros-desktop-media nosotros-desktop-media-origin">
                <Image src="/assets/matearte/nosotros-desktop/origen.png" alt={t("originAlt")} fill sizes="(min-width: 1024px) 45vw, 100vw" />
              </div>
              <div className="nosotros-desktop-chapter-copy">
                <h3>{t("originTitle")}</h3>
                <p className="nosotros-desktop-year">{t("originYear")}</p>
                <p>{t("originBody")}</p>
              </div>
            </article>
          </div>

          <div className="nosotros-desktop-reveal">
            <article className="nosotros-desktop-chapter nosotros-desktop-chapter-reverse">
              <div className="nosotros-desktop-chapter-copy">
                <h3>{t("riverTitle")}</h3>
                <p className="nosotros-desktop-year">{t("riverYear")}</p>
                <p>{t("riverBody")}</p>
              </div>
              <div className="nosotros-desktop-media nosotros-desktop-media-river">
                <Image src="/assets/matearte/nosotros-desktop/dos-orillas.png" alt={t("riverAlt")} fill sizes="(min-width: 1024px) 45vw, 100vw" />
              </div>
            </article>
          </div>

          <div className="nosotros-desktop-reveal">
            <article className="nosotros-desktop-chapter">
              <div className="nosotros-desktop-media nosotros-desktop-media-brand">
                <Image src="/assets/matearte/01-marca/Logo1254.png" alt={t("brandAlt")} fill sizes="(min-width: 1024px) 45vw, 100vw" unoptimized />
              </div>
              <div className="nosotros-desktop-chapter-copy">
                <h3>{t("brandTitle")}</h3>
                <p className="nosotros-desktop-year">{t("brandYear")}</p>
                <p>{t("brandBody")}</p>
              </div>
            </article>
          </div>

          <div className="nosotros-desktop-reveal">
            <article className="nosotros-desktop-world">
              <Image src="/assets/matearte/nosotros-desktop/paysandu-mundo.png" alt={t("worldAlt")} fill sizes="(min-width: 1024px) 87vw, 100vw" quality={95} />
              <div className="nosotros-desktop-world-overlay" aria-hidden="true" />
              <div className="nosotros-desktop-world-copy">
                <h3><span>{t("worldLine1")}</span><span>{t("worldLine2")}</span></h3>
                <p>{t("worldBody")}</p>
              </div>
            </article>
          </div>
        </section>

        <section className="nosotros-desktop-cta" aria-labelledby="nosotros-cta-title">
          <h2 id="nosotros-cta-title">{t("ctaTitle")}</h2>
          <Link href="/catalogo">{t("ctaAction")}</Link>
        </section>
      </div>

      <div className="nosotros-mobile">
        <NosotrosHero variant="mobile" />

        <section className="nosotros-mobile-story" aria-labelledby="nosotros-mobile-story-title">
          <h2 id="nosotros-mobile-story-title">
            <span>{t("storyLine1")}</span>
            <span>{t("storyMobileLine2")}</span>
            <span>{t("storyMobileLine3")}</span>
          </h2>

          {mobileChapters.map((chapter) => (
            <article className="nosotros-mobile-chapter" key={chapter.year}>
              <div className={`nosotros-mobile-chapter-image ${chapter.imageClass}`}>
                <Image
                  src={chapter.image}
                  alt={t(chapter.alt)}
                  fill
                  sizes="(max-width: 1023px) calc(100vw - 48px), 342px"
                  unoptimized={chapter.image.endsWith("Logo1254.png")}
                />
              </div>
              <div className="nosotros-mobile-chapter-copy">
                <h3>{t(chapter.title)}</h3>
                <p className="nosotros-mobile-year">{t(chapter.year)}</p>
                <p>{t(chapter.body)}</p>
              </div>
            </article>
          ))}

          <article className="nosotros-mobile-world">
            <Image src="/assets/matearte/nosotros-desktop/paysandu-mundo.png" alt={t("worldAlt")} fill sizes="(max-width: 1023px) calc(100vw - 48px), 342px" quality={95} />
            <div className="nosotros-mobile-world-overlay" aria-hidden="true" />
            <div className="nosotros-mobile-world-copy">
              <h3>{t("worldTitle")}</h3>
              <p>{t("worldBody")}</p>
            </div>
          </article>
        </section>

        <section className="nosotros-mobile-cta" aria-labelledby="nosotros-mobile-cta-title">
          <h2 id="nosotros-mobile-cta-title">{t("ctaTitle")}</h2>
          <Link href="/catalogo">{t("ctaAction")}</Link>
        </section>
      </div>
    </main>
  );
}
