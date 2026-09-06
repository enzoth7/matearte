"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { MediaAsset } from "@/types/catalog";

export function ProductGallery({ images }: { images: MediaAsset[] }) {
  const t = useTranslations("product");
  const scroller = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const handleScroll = () => {
      const index = Math.round(el.scrollLeft / el.clientWidth);
      setActiveIndex(index);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div>
      <div
        ref={scroller}
        role="region"
        className="flex snap-x snap-mandatory overflow-x-auto bg-[var(--cream-deep)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-lg"
        aria-label={t("galleryLabel")}
        tabIndex={0}
      >
        {images.map((image) => (
          <div key={image.src} className="relative aspect-[4/5] w-full shrink-0 snap-start">
            <Image src={image.src} alt={image.alt} fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" priority={image === images[0]} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="mt-4 flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((image, i) => (
            <button
              key={image.src}
              type="button"
              className={`relative size-16 shrink-0 overflow-hidden rounded-md transition-all ${
                activeIndex === i
                  ? "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[#f3efe6]"
                  : "border border-black/15 hover:opacity-80"
              }`}
              onClick={() => {
                if (!scroller.current) return;
                const width = scroller.current.clientWidth;
                scroller.current.scrollTo({ left: width * i, behavior: "smooth" });
              }}
              aria-label={`Ver imagen ${i + 1}`}
            >
              <Image src={image.src} alt={image.alt} fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
