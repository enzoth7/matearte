import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { PurchasePolicyPage } from "@/components/PurchasePolicyPage";
import { purchasePolicies } from "@/content/purchases";
import { localizedAlternates, localizedOpenGraph } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const policy = purchasePolicies[locale].terms;
  return { title: policy.title, description: policy.description, alternates: localizedAlternates(locale, "/compras/terminos-y-condiciones"), openGraph: localizedOpenGraph(locale, "/compras/terminos-y-condiciones", policy.title, policy.description), robots: { index: false, follow: false } };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const policy = purchasePolicies[locale].terms;
  return <PurchasePolicyPage title={policy.title} introduction={policy.introduction} sections={policy.sections} />;
}
