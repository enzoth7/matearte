import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { PurchasePolicyPage } from "@/components/PurchasePolicyPage";
import { purchasePolicies } from "@/content/purchases";
import { localizedAlternates, localizedOpenGraph } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const policy = purchasePolicies[locale].purchase;
  return { title: policy.title, description: policy.description, alternates: localizedAlternates(locale, "/compras/condiciones-de-compra"), openGraph: localizedOpenGraph(locale, "/compras/condiciones-de-compra", policy.title, policy.description), robots: { index: false, follow: false } };
}

export default async function PurchaseConditionsPage() {
  const locale = await getLocale();
  const policy = purchasePolicies[locale].purchase;
  return <PurchasePolicyPage title={policy.title} introduction={policy.introduction} sections={policy.sections} />;
}
