import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/catalog";

export function ProductCard({ product, priority = false, headingLevel = "h3" }: { product: Product; priority?: boolean; headingLevel?: "h2" | "h3" }) {
  const image = product.images[0];
  const ProductHeading = headingLevel;
  return (
    <article className="group">
      <Link href={`/producto/${product.slug}`} className="block">
        <div className="image-frame aspect-[4/5] border border-black/10 bg-[var(--paper)]">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
            className="object-cover"
            priority={priority}
          />
          {product.editorial && <span className="absolute left-3 top-3 bg-[var(--yerba)] px-3 py-1.5 text-[0.66rem] font-semibold tracking-widest text-white uppercase">Inspiración</span>}
        </div>
        <div className="border-b border-black/20 py-5">
          <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-[var(--leather)] uppercase">{product.eyebrow}</p>
          <div className="mt-2 flex items-start justify-between gap-5">
            <ProductHeading className="display-font text-2xl leading-tight md:text-3xl">{product.name}</ProductHeading>
            <span className="shrink-0 pt-1 text-xs font-semibold uppercase tracking-wider">Ver pieza</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-black/58">Precio y disponibilidad a confirmar</p>
        </div>
      </Link>
    </article>
  );
}
