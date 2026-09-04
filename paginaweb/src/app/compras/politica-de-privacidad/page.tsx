import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { PurchasePolicyPage } from "@/components/PurchasePolicyPage";
import { purchasePolicies } from "@/content/purchases";
import { localizedAlternates, localizedOpenGraph } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const policy = purchasePolicies[locale].privacy;
  return { title: policy.title, description: policy.description, alternates: localizedAlternates(locale, "/compras/politica-de-privacidad"), openGraph: localizedOpenGraph(locale, "/compras/politica-de-privacidad", policy.title, policy.description), robots: { index: false, follow: false } };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const policy = purchasePolicies[locale].privacy;
  return <PurchasePolicyPage title={policy.title} introduction={policy.introduction} sections={policy.sections} />;
}
