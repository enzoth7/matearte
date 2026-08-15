"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import type { Category, Product } from "@/types/catalog";

export function CatalogExplorer({ products, categories, initialCategory }: { products: Product[]; categories: Category[]; initialCategory?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const category = initialCategory ?? searchParams.get("categoria") ?? "todas";
  const sort = searchParams.get("orden") ?? "editorial";

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "todas" || value === "editorial") params.delete(key);
    else params.set(key, value);
    router.replace(`/catalogo${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  };

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    const filtered = products.filter((product) => {
      const matchesCategory = category === "todas" || product.category === category;
      const haystack = `${product.name} ${product.summary} ${product.materials.join(" ")}`.toLocaleLowerCase("es");
      return matchesCategory && (!normalized || haystack.includes(normalized));
    });
    return [...filtered].sort((a, b) => sort === "nombre" ? a.name.localeCompare(b.name, "es") : Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }, [category, products, query, sort]);

  return (
    <div>
      {!initialCategory && (
        <div className="grid gap-4 border-y border-black/20 py-5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <label className="relative block">
            <span className="sr-only">Buscar productos</span>
            <MagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" size={19} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                update("q", event.target.value);
              }}
              type="search"
              placeholder="Buscar por nombre o material"
              className="min-h-12 w-full border border-black/20 bg-transparent py-3 pl-12 pr-4 outline-none transition-colors focus:border-[var(--yerba)]"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold tracking-wider uppercase">
            Categoría
            <select value={category} onChange={(event) => update("categoria", event.target.value)} className="min-h-12 min-w-48 border border-black/20 bg-[var(--cream)] px-3 text-sm normal-case tracking-normal">
              <option value="todas">Todas</option>
              {categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold tracking-wider uppercase">
            Orden
            <select value={sort} onChange={(event) => update("orden", event.target.value)} className="min-h-12 min-w-44 border border-black/20 bg-[var(--cream)] px-3 text-sm normal-case tracking-normal">
              <option value="editorial">Selección editorial</option>
              <option value="nombre">Nombre</option>
            </select>
          </label>
        </div>
      )}
      <div className="mt-8 flex items-center justify-between border-b border-black/15 pb-4 text-xs font-semibold tracking-[0.14em] uppercase">
        <p>{visible.length} {visible.length === 1 ? "pieza" : "piezas"}</p>
        <p className="text-black/45">Sin precios vigentes</p>
      </div>
      {visible.length > 0 ? (
        <div className="mt-8 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 3} headingLevel="h2" />)}
        </div>
      ) : (
        <div className="border-b border-black/20 py-24 text-center">
          <p className="display-font text-4xl">No encontramos piezas con esos criterios.</p>
          <button type="button" className="button-secondary mt-6" onClick={() => { setQuery(""); router.replace("/catalogo"); }}>Limpiar búsqueda</button>
        </div>
      )}
    </div>
  );
}
