import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/catalog";
import { getVariantColorBackground } from "@/lib/catalog-filters";

export function ProductCard({ product, priority = false, headingLevel = "h3" }: { product: Product; priority?: boolean; headingLevel?: "h2" | "h3" }) {
  const image = product.images[0];
  const ProductHeading = headingLevel;
  return (
    <article className="group">
      <Link href={`/producto/${product.slug}`} className="block">
        <div className="image-frame aspect-[4/5] border border-[var(--ink)]/10 bg-[var(--paper)]">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
            className="object-cover"
            priority={priority}
            unoptimized={image.source === "supabase"}
          />
          {product.editorial && <strong data-inline className="absolute left-3 top-3 bg-[var(--yerba)] px-3 py-1.5 text-[0.66rem] font-semibold tracking-widest text-[var(--paper)] uppercase">Inspiración</strong>}
        </div>
        <div className="border-b border-[var(--ink)]/20 py-5">
          <div className="mt-2 flex items-start justify-between gap-5">
            <ProductHeading className="display-font text-2xl leading-tight md:text-3xl">{product.name}</ProductHeading>
            <strong data-inline className="shrink-0 pt-1 text-xs font-semibold uppercase tracking-wider">Ver pieza</strong>
          </div>
          <div data-copy className="mt-3 text-sm leading-6 text-[var(--ink)]/58">Precio y disponibilidad a confirmar</div>
          {product.variants && product.variants.length > 1 && (
            <div className="mt-4 flex items-center gap-2">
              {product.variants.map((v) => {
                const colorBackground = getVariantColorBackground(v);
                return (
                  <strong data-inline
                    key={v.id}
                    className="block h-4 w-4 rounded-full border border-[var(--ink)]/20"
                    style={{ background: colorBackground }}
                    title={v.label}
                  />
                );
              })}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}
