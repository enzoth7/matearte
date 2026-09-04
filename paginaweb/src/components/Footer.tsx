import { InstagramLogo } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { FooterPurchasesDisclosure } from "@/components/FooterPurchasesDisclosure";
import { es } from "@/content/es";
import { getPathname, Link } from "@/i18n/navigation";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const footerNavigation = [
  { label: "catalog", href: "/catalogo" },
  { label: "custom", href: "/personalizados" },
  { label: "about", href: "/nosotros" },
  { label: "customers", href: "/clientes" },
  { label: "contact", href: "/contacto" },
] as const;

const purchaseLinks = [
  { label: "terms", href: "/compras/terminos-y-condiciones" },
  { label: "privacy", href: "/compras/politica-de-privacidad" },
  { label: "purchaseTerms", href: "/compras/condiciones-de-compra" },
  { label: "shipping", href: "/compras/envios" },
] as const;

export async function Footer() {
  const locale = await getLocale();
  const t = await getTranslations("footer");
  const navigation = await getTranslations("header");
  const whatsapp = await getTranslations("whatsapp");
  const whatsappUrl = buildWhatsAppUrl(es.contact.phoneHref, whatsapp("message"));
  const contactPath = getPathname({ locale, href: "/contacto" });
  return (
    <footer className="home-footer">
      <div className="home-shell home-footer-main">
        <div className="home-footer-nav">
          <p className="home-footer-label">{t("navigation")}</p>
          {footerNavigation.map((item) => <Link key={item.href} href={item.href}>{navigation(item.label)}</Link>)}
          <FooterPurchasesDisclosure />
          <div className="home-footer-socials home-footer-socials-desktop">
            <a href={es.contact.instagramUrl} target="_blank" rel="noreferrer" aria-label={t("instagramLabel")}><InstagramLogo size={18} aria-hidden="true" /></a>
          </div>
        </div>
        <nav className="home-footer-purchases" aria-label={t("purchaseInfo")}>
          <p className="home-footer-label">{t("purchases")}</p>
          {purchaseLinks.map((item) => <Link key={item.href} href={item.href}>{t(item.label)}</Link>)}
        </nav>
        <div className="home-footer-newsletter">
          <p className="home-footer-label">{t("newsTitle")}</p>
          <p><span className="home-footer-copy-desktop">{t("newsDesktop")}</span><span className="home-footer-copy-mobile">{t("newsMobile")}</span></p>
          <form action={contactPath} method="get">
            <label htmlFor="site-newsletter-email">{t("email")}</label>
            <input id="site-newsletter-email" name="email" type="email" autoComplete="email" placeholder={t("email")} required />
            <div>
              <input name="nombre" type="text" autoComplete="name" placeholder={t("name")} aria-label={t("name")} />
              <button type="submit"><span className="home-footer-button-desktop">{t("subscribe")}</span><span className="home-footer-button-mobile">{t("subscribeMobile")}</span></button>
            </div>
          </form>
        </div>
        <div className="home-footer-contact">
          <Link className="home-footer-label" href="/contacto">{t("writeUs")}</Link>
          <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label={t("whatsappLabel", { phone: es.contact.phoneDisplay })}>{es.contact.phoneDisplay}</a>
          <p>25 de Mayo 1734<br />Paysandú, Uruguay</p>
          <div className="home-footer-socials home-footer-socials-mobile">
            <a href={es.contact.instagramUrl} target="_blank" rel="noreferrer" aria-label={t("instagramLabel")}><InstagramLogo size={18} aria-hidden="true" /></a>
          </div>
        </div>
      </div>
      <div className="home-footer-bottom">
        <div className="home-shell">
          <p>{t("rights", { year: new Date().getFullYear() })}</p>
          <a className="home-polarist" href="https://polarist.app/" target="_blank" rel="noreferrer">
            <Image src="/assets/matearte/home-v2/polarist.png" alt="" width={20} height={20} />
            {t("createdBy")}
          </a>
        </div>
      </div>
    </footer>
  );
}
