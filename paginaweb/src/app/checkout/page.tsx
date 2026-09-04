import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckoutForm } from "@/components/CheckoutForm";
import { localizedAlternates } from "@/i18n/metadata";
import { countryName } from "@/lib/countries";
import { requireUser } from "@/lib/supabase/server";
import type { Locale } from "@/types/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale() as Locale;
  const t = await getTranslations("checkout");
  return { title: t("metadataTitle"), alternates: localizedAlternates(locale, "/checkout"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage() {
  const locale = await getLocale() as Locale;
  const t = await getTranslations("checkout");
  const { user, client } = await requireUser();
  const { data: profile } = user
    ? await client.from("customer_profiles").select("full_name,phone,country_code,department,city,address_line1,postal_code").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const address = [profile?.address_line1, profile?.city, profile?.postal_code].filter(Boolean).join(", ");
  const initialCustomer = {
    fullName: profile?.full_name || (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : ""),
    phone: profile?.phone || "",
    department: profile?.department || "",
    address,
  };
  const countryCode = profile?.country_code || "UY";
  return <main id="contenido" className="section-space"><div className="container-shell"><p className="eyebrow text-[var(--leather)]">{t("eyebrow")}</p><h1 className="display-xl mt-7">{t("title")}</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-black/60">{t("intro")}</p><div className="mt-12"><CheckoutForm initialCustomer={initialCustomer} initialDestination={{ international: countryCode !== "UY", country: countryCode === "UY" ? "" : countryName(countryCode, locale), city: profile?.city || "" }} /></div></div></main>;
}
