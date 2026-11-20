import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { GuiasIndice } from "@/components/GuidePage";
import { guias } from "@/content/guias";
import { localizedPageMetadata } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("guidesPage");
  return localizedPageMetadata(locale, "/guias", t("metaTitle"), t("metaDescription"));
}

export default async function GuiasPage() {
  const locale = await getLocale();
  return <GuiasIndice guias={guias[locale]} />;
}
