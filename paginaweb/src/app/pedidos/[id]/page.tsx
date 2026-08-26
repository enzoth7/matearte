import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { OrderStatus } from "@/components/OrderStatus";

export const metadata: Metadata = { title: "Estado del pedido", robots: { index: false, follow: false } };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main id="contenido" className="pb-24 pt-8 sm:pb-32 sm:pt-12">
      <div className="container-shell">
        <Link href="/perfil" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--walnut)] transition-colors hover:text-[var(--leather)]">
          <ArrowLeft size={18} aria-hidden="true" />
          Volver a mis pedidos
        </Link>
        <div className="mt-8 max-w-3xl sm:mt-10">
          <p className="eyebrow text-[var(--leather)]">Mi cuenta</p>
          <h1 className="display-font mt-5 text-4xl font-medium tracking-[-0.025em] sm:text-5xl">Estado del pedido</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-black/60 sm:text-base">
            Consultá el detalle y seguí cada cambio confirmado de tu compra.
          </p>
        </div>
        <div className="mt-8 sm:mt-10"><OrderStatus orderId={id} /></div>
      </div>
    </main>
  );
}
