"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";

const purchaseLinks = [
  { label: "terms", href: "/compras/terminos-y-condiciones" },
  { label: "privacy", href: "/compras/politica-de-privacidad" },
  { label: "purchaseTerms", href: "/compras/condiciones-de-compra" },
  { label: "shipping", href: "/compras/envios" },
] as const;

export function FooterPurchasesDisclosure() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("footer");

  return (
    <div className="home-footer-purchases-mobile">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="home-footer-purchases-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{open ? t("showLess") : t("showMore")}</span>
        <CaretDown size={16} weight="bold" aria-hidden="true" />
      </button>
      <div
        id="home-footer-purchases-panel"
        className={`home-footer-purchases-panel${open ? " is-open" : ""}`}
        aria-hidden={!open}
        inert={!open}
      >
        <nav aria-label={t("purchaseInfo")}>
          {purchaseLinks.map((item) => <Link key={item.href} href={item.href}>{t(item.label)}</Link>)}
        </nav>
      </div>
    </div>
  );
}
