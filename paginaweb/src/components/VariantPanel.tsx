"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ProductVariant } from "@/types/catalog";

export function VariantPanel({ variants }: { variants: ProductVariant[] }) {
  const t = useTranslations("product");
  const [selected, setSelected] = useState(variants[0]?.id ?? "");

  if (variants.length === 0) return null;

  return (
    <fieldset className="border-y border-black/15 py-6">
      <legend className="text-xs font-semibold tracking-[0.16em] uppercase">{t("variantOptions")}</legend>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {variants.map((variant) => (
          <label key={variant.id} className={`flex min-h-14 cursor-pointer items-center justify-between border px-4 py-3 text-sm transition-colors ${selected === variant.id ? "border-[var(--ink)] bg-[var(--paper)]" : "border-black/15 hover:border-black/40"}`}>
            <span>
              <span className="block font-semibold">{variant.label}</span>
              <span className="block text-black/55">{variant.value}</span>
            </span>
            <input type="radio" name="variant" value={variant.id} checked={selected === variant.id} onChange={() => setSelected(variant.id)} className="size-4 accent-[var(--leather)]" />
          </label>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-black/55">{t("referenceNote")}</p>
    </fieldset>
  );
}
