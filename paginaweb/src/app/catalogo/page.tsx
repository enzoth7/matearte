import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogExplorer } from "@/components/CatalogExplorer";
import { categories, products } from "@/data/catalog";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Explorá mates, bombillas, materas, termos y regalos MateArte.",
  alternates: { canonical: "/catalogo" },
};

export default function CatalogPage() {
  return (
    <main id="contenido" className="section-space">
      <div className="container-shell">
        <p className="eyebrow text-[var(--leather)]">Catálogo MateArte</p>
        <h1 className="display-xl mt-7 max-w-[12ch]">Piezas para el ritual cotidiano.</h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-black/65">Explorá el catálogo visual. La web no presenta precios ni disponibilidad hasta recibir datos comerciales vigentes.</p>
        <Suspense fallback={<div className="mt-12 min-h-96 border-y border-black/15 py-12">Cargando catálogo…</div>}>
          <div className="mt-14"><CatalogExplorer products={products} categories={categories} /></div>
        </Suspense>
      </div>
    </main>
  );
}
