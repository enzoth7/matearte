import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/types/catalog";

export function CategoryCard({ category, index }: { category: Category; index: number }) {
  return (
    <Link href={`/catalogo/${category.slug}`} className="group block border-t border-black/20 pt-4">
      <div className={`image-frame aspect-[4/5] ${index % 2 === 1 ? "md:mt-10" : ""}`}>
        <Image
          src={category.image.src}
          alt={category.image.alt}
          fill
          sizes="(max-width: 640px) 80vw, (max-width: 1024px) 45vw, 22vw"
          className="object-cover"
        />
        <span className="absolute right-3 top-3 bg-[var(--paper)] px-3 py-1 text-[0.68rem] font-semibold tracking-widest">0{index + 1}</span>
      </div>
      <div className="flex items-start justify-between gap-4 py-5">
        <div>
          <h3 className="display-font text-3xl leading-none">{category.name}</h3>
          <p className="mt-3 max-w-xs text-sm leading-6 text-black/60">{category.description}</p>
        </div>
        <span className="mt-1 text-xs font-semibold tracking-widest uppercase">Ver</span>
      </div>
    </Link>
  );
}
