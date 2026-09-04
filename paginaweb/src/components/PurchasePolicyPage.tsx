import { getTranslations } from "next-intl/server";
import { es } from "@/content/es";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export type PurchasePolicySection = {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

export async function PurchasePolicyPage({ title, introduction, sections }: { title: string; introduction: string; sections: readonly PurchasePolicySection[] }) {
  const t = await getTranslations("purchasePolicy");
  const whatsapp = await getTranslations("whatsapp");
  const whatsappUrl = buildWhatsAppUrl(es.contact.phoneHref, whatsapp("message"));
  return (
    <main id="contenido" className="purchase-policy-page">
      <div className="purchase-policy-shell">
        <div className="purchase-policy-heading">
          <h1>{title}</h1>
          <p>{introduction}</p>
        </div>

        <div className="purchase-policy-content">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
            </section>
          ))}
        </div>

        <section className="purchase-policy-contact">
          <h2>{t("contactTitle")}</h2>
          <p>{t("contactBody")}</p>
          <div>
            <a className="purchase-policy-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">{t("whatsappAction")}</a>
            <a href={`mailto:${es.contact.email}`}>{es.contact.email}</a>
          </div>
        </section>
      </div>
    </main>
  );
}
