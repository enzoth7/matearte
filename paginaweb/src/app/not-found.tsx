import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main id="contenido" className="section-space min-h-[65svh]">
      <div className="container-shell text-center">
        <h1 className="display-lg mx-auto mt-7">{t("title")}</h1>
        <div data-copy className="mt-6 text-[var(--ink)]/60">{t("body")}</div>
        <Link className="button-primary mt-8" href="/catalogo">{t("action")}</Link>
      </div>
    </main>
  );
}
