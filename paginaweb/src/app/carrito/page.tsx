import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartPanel } from "@/components/CartPanel";
import { isCommerceAvailable } from "@/types/commerce";

export const metadata: Metadata = { title: "Carrito", robots: { index: false, follow: false } };

export default function CarritoPage() {
  if (!isCommerceAvailable()) notFound();
  return <main id="contenido" className="section-space"><div className="container-shell"><p className="eyebrow text-[var(--leather)]">Compra</p><h1 className="display-xl mt-7">Carrito</h1><div className="mt-12"><CartPanel /></div></div></main>;
}
