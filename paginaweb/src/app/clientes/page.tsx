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
              <h1 id="destinations-heading" className="international-hero-title">{t("titleLine1")}<br />{t("titleLine2")}</h1>
            </div>
            <div data-copy>
              <strong data-inline className="clientes-copy-desktop">{t("introDesktop")}</strong>
              <strong data-inline className="clientes-copy-mobile">{t("introMobile")}</strong>
            </div>
          </div>
          <InternationalWorldMap destinations={data.destinations} />
          <div data-copy className="legal-note mt-10 max-w-3xl">{t("legalNote")}</div>
        </div>
      </section>

      <TestimonialsSection data={testimonialsData} />

      <section className="international-cta">
        <div className="container-shell international-cta-grid">
          <h2 className="display-lg">
            <strong data-inline className="clientes-copy-desktop">{t("ctaDesktop")}</strong>
            <strong data-inline className="clientes-copy-mobile">{t("ctaMobile1")}<br />{t("ctaMobile2")}<br />{t("ctaMobile3")}</strong>
          </h2>
          <div>
            <div data-copy>
              <strong data-inline className="clientes-copy-desktop">{t("ctaBodyDesktop")}</strong>
              <strong data-inline className="clientes-copy-mobile">{t("ctaBodyMobile")}</strong>
            </div>
            <Link className="button-primary mt-8" href="/contacto">{t("ctaAction")}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
