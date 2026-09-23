import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { EnterpriseMotion } from "@/components/EnterpriseMotion";
import { JsonLd } from "@/components/JsonLd";
import { localizedPageMetadata } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { buildEnterpriseStructuredData } from "@/lib/seo";
import styles from "./EmpresasPage.module.css";

const companyAssets = "/assets/matearte/companies";
const giftAssets = "/assets/matearte/regalos-empresariales";

const companies = [
  { name: "Nicolini", image: "Nicolini.png", slug: "nicolini", width: 720, height: 720 },
  { name: "Grupo Bidart", image: "GrupoBidart.png", slug: "grupo-bidart", width: 1024, height: 310 },
  { name: "Publiled", image: "Publiled.png", slug: "publiled", width: 720, height: 720 },
  { name: "Nutex", image: "Nutex.png", slug: "nutex", width: 1263, height: 452 },
  { name: "Ponsse", image: "Ponsse.png", slug: "ponsse", width: 320, height: 320 },
  { name: "Grido Fray Bentos", image: "GridoFrayBentos.png", slug: "grido", width: 720, height: 720 },
] as const;

const mobileRows = [companies.slice(0, 3), companies.slice(3)] as const;

function LogoRun({ items, duplicate = false }: { items: readonly (typeof companies)[number][]; duplicate?: boolean }) {
  return (
    <div className={styles.logoRun} aria-hidden={duplicate ? "true" : undefined}>
      {items.map((company) => (
        <div className={styles.logo} data-logo={company.slug} key={`${company.slug}-${duplicate ? "duplicate" : "original"}`}>
          <Image
            src={`${companyAssets}/${company.image}`}
            alt={duplicate ? "" : company.name}
            width={company.width}
            height={company.height}
            sizes="(max-width: 1023px) 120px, 215px"
          />
        </div>
      ))}
    </div>
  );
}

function LogoCarousel({ items, label, className = "", intro = false }: { items: readonly (typeof companies)[number][]; label: string; className?: string; intro?: boolean }) {
  return (
    <div
      className={`${styles.logoCarousel} ${className}`}
      role="region"
      aria-label={label}
      data-enterprise-reveal={intro ? "up" : undefined}
      data-enterprise-intro={intro ? "" : undefined}
      data-enterprise-delay={intro ? "3" : undefined}
    >
      <div className={styles.logoTrack}>
        <LogoRun items={items} />
        <LogoRun items={items} duplicate />
      </div>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("enterprisePage");
  return localizedPageMetadata(locale, "/empresas", t("metadataTitle"), t("metadataDescription"), {
    socialTitle: t("openGraphTitle"),
    socialDescription: t("openGraphDescription"),
    keywords: t("seoKeywords").split(",").map((keyword) => keyword.trim()),
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    image: {
      url: `${giftAssets}/Grido.jpeg`,
      width: 3213,
      height: 5712,
      alt: t("heroAlt"),
    },
  });
}

export default async function EmpresasPage() {
  const locale = await getLocale();
  const t = await getTranslations("enterprisePage");
  const steps = [1, 2, 3, 4] as const;

  return (
    <main id="contenido" className={`${styles.page} empresas-page`}>
      <JsonLd
        data={buildEnterpriseStructuredData(
          locale,
          t("metadataTitle"),
          t("metadataDescription"),
          "MateArte",
        )}
      />

      <section className={styles.hero} aria-labelledby="enterprise-hero-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy} data-enterprise-reveal="left" data-enterprise-intro data-enterprise-delay="1">
            <h1 id="enterprise-hero-title">{t("heroTitle1")}<br />{t("heroTitle2")}</h1>
            <p>{t("heroBody")}</p>
            <Link className={styles.button} href="/contacto">{t("heroAction")}</Link>
          </div>
          <div className={styles.heroImage} data-enterprise-reveal="scale" data-enterprise-intro data-enterprise-delay="2">
            <Image src={`${giftAssets}/Grido.jpeg`} alt={t("heroAlt")} fill priority sizes="(max-width: 1023px) calc(100vw - 48px), 576px" />
          </div>
        </div>
        <LogoCarousel items={companies} label={t("logoCarouselLabel")} className={styles.desktopLogos} intro />
        <div className={styles.mobileLogos} data-enterprise-reveal="up" data-enterprise-intro data-enterprise-delay="3">
          {mobileRows.map((row, index) => <LogoCarousel items={row} label={`${t("logoCarouselLabel")} ${index + 1}`} key={index} />)}
        </div>
      </section>

      <section className={styles.craft} aria-labelledby="enterprise-craft-title">
        <div className={styles.craftInner}>
          <div className={styles.craftCopy} data-enterprise-reveal="left">
            <h2 id="enterprise-craft-title">{t("craftTitle")}</h2>
            <p className={styles.craftBody}>{t("craftBody")}</p>
            <p className={styles.craftNote}>{t("craftNote")}</p>
          </div>
          <div className={styles.craftGallery}>
            <div className={styles.craftImage} data-enterprise-reveal="up" data-enterprise-delay="1">
              <Image src={`${giftAssets}/Publiled1.jpeg`} alt={t("publiledAlt")} fill sizes="(max-width: 1023px) calc((100vw - 60px) / 2), 352px" />
            </div>
            <div className={styles.craftImage} data-enterprise-reveal="up" data-enterprise-delay="2">
              <Image src={`${giftAssets}/Nutex1.jpeg`} alt={t("nutexAlt")} fill sizes="(max-width: 1023px) calc((100vw - 60px) / 2), 352px" />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.process} aria-labelledby="enterprise-process-title">
        <div className={styles.processInner}>
          <div className={styles.processIntro} data-enterprise-reveal="left">
            <h2 id="enterprise-process-title">{t("processTitle1")}<br />{t("processTitle2")}</h2>
            <p>{t("processBody")}</p>
          </div>
          <div className={styles.steps}>
            {steps.map((step) => (
              <article className={styles.step} data-enterprise-reveal="up" data-enterprise-delay={step} key={step}>
                <p className={styles.stepNumber}>0{step}</p>
                <h3>{t(`step${step}Title`)}</h3>
                <p>{t(`step${step}Body`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="enterprise-closing-title">
        <div className={styles.closingInner} data-enterprise-reveal="scale">
          <h2 id="enterprise-closing-title">{t("closingTitle1")}<br />{t("closingTitle2")}</h2>
          <p>{t("closingBody")}</p>
          <Link className={styles.button} href="/contacto">{t("closingAction")}</Link>
        </div>
      </section>
      <EnterpriseMotion />
    </main>
  );
}
