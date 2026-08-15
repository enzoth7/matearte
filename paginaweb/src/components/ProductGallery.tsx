"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import Image from "next/image";
import { useRef } from "react";
import type { MediaAsset } from "@/types/catalog";

export function ProductGallery({ images }: { images: MediaAsset[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  const move = (direction: -1 | 1) => {
    const width = scroller.current?.clientWidth ?? 0;
    scroller.current?.scrollBy({ left: width * direction, behavior: "smooth" });
  };

  return (
    <div>
      <div
        ref={scroller}
        role="region"
        className="flex snap-x snap-mandatory overflow-x-auto bg-[var(--cream-deep)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Galería de producto"
        tabIndex={0}
      >
        {images.map((image) => (
          <div key={image.src} className="relative aspect-[4/5] w-full shrink-0 snap-start">
            <Image src={image.src} alt={image.alt} fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" priority={image === images[0]} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs tracking-[0.14em] uppercase text-black/55">Deslizá para explorar · {images.length} vistas</p>
          <div className="flex gap-1">
            <button type="button" className="flex size-11 items-center justify-center border border-black/20 transition-colors hover:bg-[var(--ink)] hover:text-white" onClick={() => move(-1)} aria-label="Imagen anterior">
              <CaretLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" className="flex size-11 items-center justify-center border border-black/20 transition-colors hover:bg-[var(--ink)] hover:text-white" onClick={() => move(1)} aria-label="Imagen siguiente">
              <CaretRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
