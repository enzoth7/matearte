"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type RemoteItem = {
  id: string; item_type: "catalog" | "design"; quantity: number;
  unit_price_minor: number; currency: string;
  variant: null | { name: string; price_minor: number; currency: string; product: { name: string } };
  design: null | { title: string };
};
type Cart = { id: string; items: RemoteItem[] };

const money = (minor: number) => new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 }).format(minor / 100);

export function CartPanel() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/cart", { cache: "no-store" });
    if (response.status === 401) { setNeedsLogin(true); return; }
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || "No se pudo cargar el carrito.");
    setCart(value); setNeedsLogin(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason) => setError(reason.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const mutate = async (method: "PATCH" | "DELETE", itemId: string, quantity?: number) => {
    setBusy(itemId); setError("");
    try {
      const response = await fetch("/api/cart/items", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, quantity }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setCart(value);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar."); }
    finally { setBusy(""); }
  };

  if (needsLogin) return (
    <div className="border-y border-black/20 py-16 text-center">
      <p className="display-font text-4xl">Tu carrito te espera.</p>
      <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-black/60">Podés explorar como visitante. Para guardar diseños, unir el carrito y comprar, ingresá desde el visualizador.</p>
      <a className="mt-8 inline-flex min-h-12 items-center bg-[var(--walnut)] px-7 text-sm font-semibold text-white" href={`${process.env.NEXT_PUBLIC_CUSTOMIZER_URL || "http://localhost:5173"}/?auth=login&next=cart`}>Ingresar o crear cuenta</a>
    </div>
  );
  if (!cart) return <p role="status" className="py-16 text-center">Cargando carrito…</p>;
  if (cart.items.length === 0) return (
    <div className="border-y border-black/20 py-16 text-center"><p className="display-font text-4xl">Tu carrito está vacío.</p><p className="mt-4 text-sm text-black/60">Elegí una pieza del catálogo o agregá uno de tus diseños.</p><Link className="mt-8 inline-flex min-h-12 items-center bg-[var(--walnut)] px-7 text-sm font-semibold text-white" href="/catalogo">Ver catálogo</Link></div>
  );
  const subtotal = cart.items.reduce((sum, item) => sum + item.unit_price_minor * item.quantity, 0);
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="divide-y divide-black/15 border-y border-black/15">
        {cart.items.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-5 py-6">
          <div><p className="eyebrow text-[var(--leather)]">{item.item_type === "design" ? "Personalizado" : item.variant?.name}</p><h2 className="display-font mt-2 text-2xl">{item.design?.title || item.variant?.product.name}</h2><p className="mt-2 text-sm text-black/60">{money(item.unit_price_minor)} c/u</p></div>
          <div className="flex items-center gap-3">
            {item.item_type === "catalog" && <input aria-label="Cantidad" className="h-11 w-16 border border-black/20 bg-transparent px-2 text-center" type="number" min={1} max={99} value={item.quantity} disabled={busy === item.id} onChange={(event) => mutate("PATCH", item.id, Number(event.target.value))} />}
            <button className="min-h-11 px-3 text-sm underline" disabled={busy === item.id} onClick={() => mutate("DELETE", item.id)}>Quitar</button>
          </div>
        </article>)}
        {error && <p role="alert" className="py-4 text-sm text-red-700">{error}</p>}
      </div>
      <aside className="h-fit bg-[var(--paper)] p-6">
        <p className="eyebrow">Resumen</p><div className="mt-5 flex justify-between"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
        <p className="mt-4 text-xs leading-5 text-black/55">El envío y cualquier comisión habilitada se calculan al continuar.</p>
        <Link href="/checkout" className="mt-6 flex min-h-12 items-center justify-center bg-[var(--walnut)] px-6 text-sm font-semibold text-white">Continuar</Link>
      </aside>
    </div>
  );
}
