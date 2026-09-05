import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { EnvelopeSimple, MapPin } from "@phosphor-icons/react/dist/ssr";
import { JsonLd } from "@/components/JsonLd";
import { es } from "@/content/es";
import { localizedPageMetadata } from "@/i18n/metadata";
import { Link } from "@/i18n/navigation";
import { buildPageStructuredData } from "@/lib/seo";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("contact");
  return localizedPageMetadata(locale, "/contacto", t("metadataTitle"), t("metadataDescription"));
}

const mapsUrl = "https://www.google.com/maps/search/?api=1&query=25+de+Mayo+1734+Paysandu+Uruguay";
const contactWhatsAppMessage = "¡Hola! Vengo desde la web de MateArte y me gustaría hacer una consulta. ¡Gracias!";
export default async function ContactoPage() {
  const locale = await getLocale();
  const t = await getTranslations("contact");
  const whatsappUrl = buildWhatsAppUrl(es.contact.phoneHref, contactWhatsAppMessage);
  return (
    <main id="contenido" className="contact-page">
      <JsonLd data={buildPageStructuredData({ locale, href: "/contacto", name: t("metadataTitle"), description: t("metadataDescription"), type: "ContactPage", homeLabel: "MateArte", includeOrganization: true })} />
      <div className="contact-desktop" aria-label={t("pageLabel")}>
        <section className="contact-desktop-hero">
          <div className="contact-desktop-hero-copy">
            <h1>{t("title")}</h1>
            <p>{t("intro")}</p>
          </div>
          <div className="contact-desktop-hero-image">
            <Image
              src="/assets/matearte/contact-desktop/local.png"
              alt={t("storeAlt")}
              fill
              priority
              sizes="364px"
            />
          </div>
        </section>

        <section className="contact-desktop-channels" aria-label={t("channels")}>
          <div className="contact-desktop-channels-grid">
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="contact-desktop-channel-card">
              <MapPin aria-hidden="true" weight="regular" />
              <span>25 de Mayo 1734,<br />Paysandú, Uruguay</span>
            </a>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="contact-desktop-channel-card">
              <Image className="contact-desktop-channel-icon" src="/assets/matearte/contact-desktop/whatsapp.png" alt="" width={52} height={52} aria-hidden="true" />
              <span>{es.contact.phoneDisplay}</span>
            </a>
            <a href={`mailto:${es.contact.email}`} className="contact-desktop-channel-card contact-desktop-channel-email">
              <EnvelopeSimple aria-hidden="true" weight="regular" />
              <span>{es.contact.email}</span>
            </a>
            <a href={es.contact.instagramUrl} target="_blank" rel="noreferrer" className="contact-desktop-channel-card">
              <Image className="contact-desktop-channel-icon" src="/assets/matearte/contact-desktop/instagram.svg" alt="" width={51} height={51} aria-hidden="true" />
              <span>{es.contact.instagram}</span>
            </a>
          </div>
        </section>

        <section className="contact-desktop-location">
          <div className="contact-desktop-map">
            <Image
              src="/assets/matearte/contact-desktop/map.png"
              alt={t("mapAlt")}
              fill
              sizes="50vw"
            />
          </div>
          <div className="contact-desktop-location-copy">
            <h2>{t("locationTitle")}</h2>
            <p>{t("locationBody")}</p>
            <a href={mapsUrl} target="_blank" rel="noreferrer">{t("directions")}</a>
          </div>
        </section>

        <section className="contact-desktop-cta">
          <h2>{t("customTitle")}</h2>
          <Link href="/personalizados">{t("customAction")}</Link>
        </section>
      </div>

      <div className="contact-mobile">
        <section className="contact-mobile-hero">
          <div className="contact-mobile-hero-copy">
            <h1>{t("title")}</h1>
            <p>{t("intro")}</p>
          </div>
          <div className="contact-mobile-hero-image">
            <Image
              src="/assets/matearte/contact-desktop/local.png"
              alt={t("storeAlt")}
              fill
              priority
              sizes="calc(100vw - 48px)"
            />
          </div>
        </section>

        <section className="contact-mobile-channels" aria-label={t("channels")}>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="contact-mobile-channel-card">
            <MapPin aria-hidden="true" weight="regular" />
            <span>25 de Mayo 1734, Paysandú, Uruguay</span>
          </a>
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="contact-mobile-channel-card">
            <Image className="contact-mobile-channel-icon" src="/assets/matearte/contact-desktop/whatsapp.png" alt="" width={52} height={52} aria-hidden="true" />
            <span>{es.contact.phoneDisplay}</span>
          </a>
          <a href={`mailto:${es.contact.email}`} className="contact-mobile-channel-card contact-mobile-channel-email">
            <EnvelopeSimple aria-hidden="true" weight="regular" />
            <span>{es.contact.email}</span>
          </a>
          <a href={es.contact.instagramUrl} target="_blank" rel="noreferrer" className="contact-mobile-channel-card">
            <Image className="contact-mobile-channel-icon contact-mobile-instagram-icon" src="/assets/matearte/contact-desktop/instagram.svg" alt="" width={51} height={51} aria-hidden="true" />
            <span>{es.contact.instagram}</span>
          </a>
        </section>

        <section className="contact-mobile-location">
          <div className="contact-mobile-map">
            <Image
              src="/assets/matearte/contact-desktop/map.png"
              alt={t("mapAlt")}
              fill
              priority
              sizes="100vw"
            />
          </div>
          <div className="contact-mobile-location-copy">
            <h2>{t("locationTitle")}</h2>
            <p>{t("locationBody")}</p>
            <a href={mapsUrl} target="_blank" rel="noreferrer">{t("directions")}</a>
          </div>
        </section>

        <section className="contact-mobile-cta">
          <h2>{t("customTitle")}</h2>
          <Link href="/personalizados">{t("customAction")}</Link>
        </section>
      </div>
    </main>
  );
}
