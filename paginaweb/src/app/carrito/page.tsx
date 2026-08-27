import type { Metadata } from "next";
import { CartPanel } from "@/components/CartPanel";

export const metadata: Metadata = { title: "Carrito", robots: { index: false, follow: false } };

export default function CarritoPage() {
  return (
    <main id="contenido" className="pb-24 pt-8 sm:pb-32 sm:pt-12">
      <div className="container-shell">
        <section className="overflow-hidden border border-black/15 bg-[var(--paper)] shadow-[var(--shadow-soft)]" aria-labelledby="cart-title">
          <div className="h-1.5 bg-[var(--leather)]" aria-hidden="true" />
          <header className="p-6 sm:p-8 lg:px-10 lg:py-9">
            <p className="eyebrow text-[var(--leather)]">Compra</p>
            <h1 id="cart-title" className="display-font mt-5 text-5xl font-medium tracking-[-0.03em] sm:text-6xl">Carrito</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-black/60 sm:text-base">
              Revisá tu selección antes de elegir la entrega y continuar con el pago.
            </p>
          </header>
          <div className="border-t border-black/10">
            <CartPanel />
          </div>
        </section>
      </div>
    </main>
  );
}
