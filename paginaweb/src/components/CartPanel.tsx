"use client";

import { ArrowRight, Package, ShoppingBagOpen, Trash } from "@phosphor-icons/react";
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
    <div className="px-6 py-14 text-center sm:px-8 sm:py-16">
      <ShoppingBagOpen size={34} className="mx-auto text-[var(--leather)]" aria-hidden="true" />
      <p className="display-font mt-5 text-4xl">Tu carrito te espera.</p>
      <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-black/60">Podés explorar como visitante. Para guardar diseños, unir el carrito y comprar, ingresá desde el visualizador.</p>
      <a className="button-primary mt-8 gap-2" href={`${process.env.NEXT_PUBLIC_CUSTOMIZER_URL || "http://localhost:5173"}/?auth=login&next=cart`}>Ingresar o crear cuenta <ArrowRight size={17} aria-hidden="true" /></a>
    </div>
  );
  if (!cart) return (
    <div role="status" aria-live="polite" className="grid gap-8 p-6 motion-safe:animate-pulse sm:p-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-10">
      <div>
        <div className="h-4 w-32 rounded bg-black/10" />
        <div className="mt-8 h-28 rounded bg-black/5" />
      </div>
      <div className="h-56 rounded bg-black/10" />
      <span className="sr-only">Cargando carrito…</span>
    </div>
  );
  if (cart.items.length === 0) return (
    <div className="px-6 py-14 text-center sm:px-8 sm:py-16">
      <ShoppingBagOpen size={34} className="mx-auto text-[var(--leather)]" aria-hidden="true" />
      <p className="display-font mt-5 text-4xl">Tu carrito está vacío.</p>
      <p className="mt-4 text-sm text-black/60">Elegí una pieza del catálogo o agregá uno de tus diseños.</p>
      <Link className="button-primary mt-8 gap-2" href="/catalogo">Ver catálogo <ArrowRight size={17} aria-hidden="true" /></Link>
    </div>
  );
  const subtotal = cart.items.reduce((sum, item) => sum + item.unit_price_minor * item.quantity, 0);
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="flex items-center justify-between gap-4 border-b border-black/10 pb-5">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-[var(--walnut)] uppercase">
            <ShoppingBagOpen size={19} className="text-[var(--leather)]" aria-hidden="true" />
            Tu selección
          </p>
          <p className="text-xs text-black/50">{cart.items.length} {cart.items.length === 1 ? "artículo" : "artículos"}</p>
        </div>
        <div className="divide-y divide-black/10">
          {cart.items.map((item) => (
            <article key={item.id} className="flex flex-col gap-5 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--cream-deep)] text-[var(--leather)]">
                  <Package size={22} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-semibold tracking-[0.13em] text-[var(--leather)] uppercase">{item.item_type === "design" ? "Personalizado" : item.variant?.name}</p>
                  <h2 className="display-font mt-2 text-2xl leading-tight">{item.design?.title || item.variant?.product.name}</h2>
                  <p className="mt-2 text-sm text-black/55">{money(item.unit_price_minor)} c/u</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 sm:shrink-0">
                {item.item_type === "catalog" && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-black/55">
                    Cantidad
                    <input aria-label={`Cantidad de ${item.variant?.product.name || "producto"}`} className="h-11 w-16 rounded border border-black/20 bg-white px-2 text-center disabled:cursor-wait disabled:opacity-50" type="number" min={1} max={99} value={item.quantity} disabled={busy === item.id} onChange={(event) => mutate("PATCH", item.id, Number(event.target.value))} />
                  </label>
                )}
                <button className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/5 disabled:cursor-wait disabled:opacity-50" disabled={busy === item.id} onClick={() => mutate("DELETE", item.id)}>
                  <Trash size={18} aria-hidden="true" /> Quitar
                </button>
              </div>
            </article>
          ))}
        </div>
        {error && <p role="alert" className="border-t border-[var(--danger)]/20 pt-4 text-sm text-[var(--danger)]">{error}</p>}
      </div>
      <aside className="border-t border-black/10 bg-[var(--cream-deep)]/45 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-9" aria-label="Resumen del carrito">
        <p className="eyebrow text-[var(--leather)]">Resumen</p>
        <div className="mt-6 flex items-end justify-between gap-5 border-b border-black/10 pb-6">
          <span className="text-sm text-black/65">Subtotal</span>
          <strong className="display-font text-3xl tabular-nums">{money(subtotal)}</strong>
        </div>
        <p className="mt-6 text-xs leading-6 text-black/55">El envío y cualquier comisión habilitada se calculan al continuar.</p>
        <Link href="/checkout" className="button-primary mt-7 w-full gap-2">Continuar <ArrowRight size={17} aria-hidden="true" /></Link>
      </aside>
    </div>
  );
}
