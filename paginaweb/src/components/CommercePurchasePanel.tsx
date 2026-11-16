"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addLocalCartItem } from "@/lib/browser-cart";
import { Link } from "@/i18n/navigation";

type Variant = { id: string; sku: string; name: string; price_minor: number; option_values?: Record<string, string | number | boolean> };
export function CommercePurchasePanel({ slug }: { slug: string }) {
  const locale = useLocale();
  const t = useTranslations("product");
  const [data, setData] = useState<{ available: boolean; commerceEnabled: boolean; product: { variants: Variant[] } | null } | null>(null);
  const [selected, setSelected] = useState(""); const [message, setMessage] = useState(""); const [added, setAdded] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`/api/catalog/products?slug=${encodeURIComponent(slug)}`).then((response) => response.json()).then((value) => { setData(value); setSelected(value.product?.variants?.[0]?.id || ""); }); }, [slug]);
  if (!data) return <div className="mt-7 border border-[var(--ink)]/20 bg-[var(--paper)] p-5 text-sm">{t("checking")}</div>;
  if (!data.available || !data.product) return <div className="mt-7 border border-[var(--ink)]/20 bg-[var(--paper)] p-5"><div data-copy className="text-sm font-semibold">{t("purchaseUnavailable")}</div><div data-copy className="mt-2 text-sm leading-6 text-[var(--ink)]/58">{t("unavailableBody")}</div></div>;
  const variant = data.product.variants.find((item) => item.id === selected)!;
  const add = async () => {
    setBusy(true); setMessage(""); setAdded(false);
    const response = await fetch("/api/cart/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemType: "catalog", variantId: selected, quantity: 1, locale, optionValuesOverride: variant.option_values || {} }) });
    if (response.status === 401) { addLocalCartItem(selected, 1, variant.option_values); setMessage(t("savedLocally")); setAdded(true); }
    else { await response.json(); if (response.ok) { setAdded(true); } else { setMessage(t("addFailed")); } }
    setBusy(false);
  };
  return <section className="mt-7 border border-[var(--ink)]/20 bg-[var(--paper)] p-5"><label className="text-xs font-semibold uppercase tracking-widest">{t("variant")}<select className="mt-2 h-12 w-full border border-[var(--ink)]/20 bg-transparent px-3 text-sm normal-case tracking-normal" value={selected} onChange={(e) => { setSelected(e.target.value); setAdded(false); setMessage(""); }}>{data.product.variants.map((item) => <option key={item.id} value={item.id}>{item.name} , $ {(item.price_minor / 100).toLocaleString("es-UY")} UYU</option>)}</select></label><div data-copy className="mt-4 display-font text-3xl">$ {(variant.price_minor / 100).toLocaleString("es-UY")} UYU</div>{!data.commerceEnabled && <div data-copy className="mt-3 text-xs text-[var(--ink)]">{t("catalogReady")}</div>}<button disabled={busy || !data.commerceEnabled} onClick={() => void add()} className="mt-5 min-h-12 w-full bg-[var(--walnut)] px-5 text-sm font-semibold text-[var(--paper)] disabled:opacity-50">{busy ? t("adding") : added ? t("added") : t("addToCart")}</button>{added && <Link href="/carrito" className="mt-3 block text-center text-xs font-semibold underline underline-offset-2">{t("goToCart")}</Link>}{message && !added && <div data-copy role="status" className="mt-3 text-xs leading-5">{message}</div>}</section>;
}
