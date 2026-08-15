import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogExplorer } from "@/components/CatalogExplorer";
import { categories, getCategory, products } from "@/data/catalog";

export function generateStaticParams() {
  return categories.map((category) => ({ categoria: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ categoria: string }> }): Promise<Metadata> {
  const { categoria } = await params;
  const category = getCategory(categoria);
  if (!category) return {};
  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/catalogo/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ categoria: string }> }) {
  const { categoria } = await params;
  const category = getCategory(categoria);
  if (!category) notFound();
  const categoryProducts = products.filter((product) => product.category === category.slug);
  return (
    <main id="contenido" className="section-space">
      <div className="container-shell">
        <p className="eyebrow text-[var(--leather)]">Catálogo / {category.name}</p>
        <h1 className="display-xl mt-7">{category.name}</h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-black/65">{category.description}</p>
        <Suspense fallback={<div className="mt-14 min-h-96 border-y border-black/15 py-12">Cargando categoría…</div>}>
          <div className="mt-14"><CatalogExplorer products={categoryProducts} categories={categories} initialCategory={category.slug} /></div>
        </Suspense>
      </div>
    </main>
  );
}
