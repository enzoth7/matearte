import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import TestimonialsSection from "@/components/ui/community-testimonial";
import { InternationalWorldMap } from "@/components/ui/international-world-map";
import { JsonLd } from "@/components/JsonLd";
import { getLocalizedInternationalData } from "@/data/international-clients";
import { localizedPageMetadata } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { buildPageStructuredData } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("customersPage");
  return localizedPageMetadata(locale, "/clientes", t("metadataTitle"), t("metadataDescription"), {
    socialTitle: t("openGraphTitle"),
    socialDescription: t("openGraphDescription"),
  });
}

export default async function ClientesPage() {
  const locale = await getLocale();
  const t = await getTranslations("customersPage");
  const data = getLocalizedInternationalData(locale);
  const testimonialsData = { title: t("testimonialsTitle"), subtitle: t("testimonialsSubtitle"), rows: data.testimonialRows };
  return (
    <main id="contenido" className="clientes-page">
      <JsonLd data={buildPageStructuredData({ locale, href: "/clientes", name: t("metadataTitle"), description: t("metadataDescription"), homeLabel: "MateArte" })} />
      <section className="international-map-section" aria-labelledby="destinations-heading">
        <div className="container-shell">
          <div className="international-section-heading">
            <div>
              <p className="eyebrow text-[var(--leather)]">{t("eyebrow")}</p>
              <h1 id="destinations-heading" className="international-hero-title">{t("titleLine1")}<br />{t("titleLine2")}</h1>
            </div>
            <p>
              <span className="clientes-copy-desktop">{t("introDesktop")}</span>
              <span className="clientes-copy-mobile">{t("introMobile")}</span>
            </p>
          </div>
          <InternationalWorldMap destinations={data.destinations} />
          <p className="legal-note mt-10 max-w-3xl">{t("legalNote")}</p>
        </div>
      </section>

      <TestimonialsSection data={testimonialsData} />

      <section className="international-cta">
        <div className="container-shell international-cta-grid">
          <p className="eyebrow text-[var(--leather)]">{t("ctaEyebrow")}</p>
          <h2 className="display-lg">
            <span className="clientes-copy-desktop">{t("ctaDesktop")}</span>
            <span className="clientes-copy-mobile">{t("ctaMobile1")}<br />{t("ctaMobile2")}<br />{t("ctaMobile3")}</span>
          </h2>
          <div>
            <p>
              <span className="clientes-copy-desktop">{t("ctaBodyDesktop")}</span>
              <span className="clientes-copy-mobile">{t("ctaBodyMobile")}</span>
            </p>
            <Link className="button-primary mt-8" href="/contacto">{t("ctaAction")}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
