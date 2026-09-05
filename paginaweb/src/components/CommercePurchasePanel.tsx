"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addLocalCartItem } from "@/lib/browser-cart";
import { useRouter } from "@/i18n/navigation";

type Variant = { id: string; sku: string; name: string; price_minor: number };
export function CommercePurchasePanel({ slug }: { slug: string }) {
  const locale = useLocale();
  const t = useTranslations("product");
  const router = useRouter();
  const [data, setData] = useState<{ available: boolean; commerceEnabled: boolean; product: { variants: Variant[] } | null } | null>(null);
  const [selected, setSelected] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`/api/catalog/products?slug=${encodeURIComponent(slug)}`).then((response) => response.json()).then((value) => { setData(value); setSelected(value.product?.variants?.[0]?.id || ""); }); }, [slug]);
  if (!data) return <div className="mt-7 border border-black/20 bg-[var(--paper)] p-5 text-sm">{t("checking")}</div>;
  if (!data.available || !data.product) return <div className="mt-7 border border-black/20 bg-[var(--paper)] p-5"><p className="text-sm font-semibold">{t("purchaseUnavailable")}</p><p className="mt-2 text-sm leading-6 text-black/58">{t("unavailableBody")}</p></div>;
  const variant = data.product.variants.find((item) => item.id === selected)!;
  const add = async () => {
    setBusy(true); setMessage("");
    const response = await fetch("/api/cart/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemType: "catalog", variantId: selected, quantity: 1, locale }) });
    if (response.status === 401) { addLocalCartItem(selected); router.push("/carrito"); }
    else { await response.json(); if (response.ok) { router.push("/carrito"); } else { setMessage(t("addFailed")); } }
    setBusy(false);
  };
  return <section className="mt-7 border border-black/20 bg-[var(--paper)] p-5"><label className="text-xs font-semibold uppercase tracking-widest">{t("variant")}<select className="mt-2 h-12 w-full border border-black/20 bg-transparent px-3 text-sm normal-case tracking-normal" value={selected} onChange={(e) => setSelected(e.target.value)}>{data.product.variants.map((item) => <option key={item.id} value={item.id}>{item.name} · $ {(item.price_minor / 100).toLocaleString("es-UY")} UYU</option>)}</select></label><p className="mt-4 display-font text-3xl">$ {(variant.price_minor / 100).toLocaleString("es-UY")} UYU</p>{!data.commerceEnabled && <p className="mt-3 text-xs text-amber-800">{t("catalogReady")}</p>}<button disabled={busy || !data.commerceEnabled} onClick={() => void add()} className="mt-5 min-h-12 w-full bg-[var(--walnut)] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? t("adding") : t("addToCart")}</button>{message && <p role="status" className="mt-3 text-xs leading-5">{message}</p>}</section>;
}
