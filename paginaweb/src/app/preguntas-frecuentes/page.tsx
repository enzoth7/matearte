import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { PurchasePolicyPage } from "@/components/PurchasePolicyPage";
import { faqPages } from "@/content/faq";
import { localizedPageMetadata } from "@/i18n/metadata";
import { buildFaqStructuredData } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const page = faqPages[locale];
  return localizedPageMetadata(locale, "/preguntas-frecuentes", page.title, page.description);
}

export default async function FaqPage() {
  const locale = await getLocale();
  const page = faqPages[locale];
  return (
    <>
      <JsonLd data={buildFaqStructuredData(locale, page.title, page.entries, "MateArte")} />
      <PurchasePolicyPage
        title={page.title}
        introduction={page.introduction}
        sections={page.entries.map((entry) => ({ title: entry.question, paragraphs: entry.answer }))}
      />
    </>
  );
}
