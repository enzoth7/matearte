import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main id="contenido" className="section-space min-h-[65svh]">
      <div className="container-shell text-center">
        <p className="eyebrow justify-center text-[var(--leather)]">404</p>
        <h1 className="display-lg mx-auto mt-7">{t("title")}</h1>
        <p className="mt-6 text-black/60">{t("body")}</p>
        <Link className="button-primary mt-8" href="/catalogo">{t("action")}</Link>
      </div>
    </main>
  );
}
