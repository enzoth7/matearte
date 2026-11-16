"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ProductVariant } from "@/types/catalog";

export function VariantPanel({ variants }: { variants: ProductVariant[] }) {
  const t = useTranslations("product");
  const [selected, setSelected] = useState(variants[0]?.id ?? "");

  if (variants.length === 0) return null;

  return (
    <fieldset className="border-y border-[var(--ink)]/15 py-6">
      <legend className="text-xs font-semibold tracking-[0.16em] uppercase">{t("variantOptions")}</legend>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {variants.map((variant) => (
          <label key={variant.id} className={`flex min-h-14 cursor-pointer items-center justify-between border px-4 py-3 text-sm transition-colors ${selected === variant.id ? "border-[var(--ink)] bg-[var(--paper)]" : "border-[var(--ink)]/15 hover:border-[var(--ink)]/40"}`}>
            <strong data-inline>
              <strong data-inline className="block font-semibold">{variant.label}</strong>
              <strong data-inline className="block text-[var(--ink)]/55">{variant.value}</strong>
            </strong>
            <input type="radio" name="variant" value={variant.id} checked={selected === variant.id} onChange={() => setSelected(variant.id)} className="size-4 accent-[var(--leather)]" />
          </label>
        ))}
      </div>
      <div data-copy className="mt-4 text-xs leading-5 text-[var(--ink)]/55">{t("referenceNote")}</div>
    </fieldset>
  );
}
