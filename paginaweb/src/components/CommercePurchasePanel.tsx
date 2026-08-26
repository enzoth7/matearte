"use client";

import { useEffect, useState } from "react";
import { addLocalCartItem } from "@/lib/browser-cart";

type Variant = { id: string; sku: string; name: string; price_minor: number; inventory_tracked: boolean; stock_on_hand: number; stock_reserved: number };
export function CommercePurchasePanel({ slug }: { slug: string }) {
  const [data, setData] = useState<{ available: boolean; commerceEnabled: boolean; product: { variants: Variant[] } | null } | null>(null);
  const [selected, setSelected] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`/api/catalog/products?slug=${encodeURIComponent(slug)}`).then((response) => response.json()).then((value) => { setData(value); setSelected(value.product?.variants?.[0]?.id || ""); }); }, [slug]);
  if (!data) return <div className="mt-7 border border-black/20 bg-[var(--paper)] p-5 text-sm">Consultando precio y stock…</div>;
  if (!data.available || !data.product) return <div className="mt-7 border border-black/20 bg-[var(--paper)] p-5"><p className="text-sm font-semibold">Precio y compra todavía no disponibles</p><p className="mt-2 text-sm leading-6 text-black/58">La pieza aparecerá para comprar únicamente cuando tenga SKU, precio, entrega y publicación completos.</p></div>;
  const variant = data.product.variants.find((item) => item.id === selected)!;
  const add = async () => {
    setBusy(true); setMessage("");
    const response = await fetch("/api/cart/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemType: "catalog", variantId: selected, quantity: 1 }) });
    if (response.status === 401) { addLocalCartItem(selected); setMessage("Guardado en este dispositivo. Al ingresar se unirá a tu carrito."); }
    else { const value = await response.json(); setMessage(response.ok ? "Agregado al carrito." : value.error || "No se pudo agregar."); }
    setBusy(false);
  };
  return <section className="mt-7 border border-black/20 bg-[var(--paper)] p-5"><label className="text-xs font-semibold uppercase tracking-widest">Variante<select className="mt-2 h-12 w-full border border-black/20 bg-transparent px-3 text-sm normal-case tracking-normal" value={selected} onChange={(e) => setSelected(e.target.value)}>{data.product.variants.map((item) => <option key={item.id} value={item.id}>{item.name} · {(item.price_minor / 100).toLocaleString("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 })}</option>)}</select></label><p className="mt-4 display-font text-3xl">{(variant.price_minor / 100).toLocaleString("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 })}</p>{!data.commerceEnabled && <p className="mt-3 text-xs text-amber-800">Catálogo listo, venta temporalmente deshabilitada.</p>}<button disabled={busy || !data.commerceEnabled} onClick={() => void add()} className="mt-5 min-h-12 w-full bg-[var(--walnut)] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Agregando…" : "Agregar al carrito"}</button>{message && <p role="status" className="mt-3 text-xs leading-5">{message}</p>}</section>;
}
