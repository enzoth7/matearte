"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { editorialMedia, presentationMedia } from "@/data/catalog";

export function EditorialHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();
  const presentationMode = process.env.NEXT_PUBLIC_PRESENTATION_MODE !== "false";
  const heroVideo = presentationMedia.videos[2];
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], [0, 64]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.025, 1.08]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (reduceMotion) {
      video.pause();
      return;
    }

    video.play().catch(() => undefined);
  }, [reduceMotion]);

  return (
    <section ref={sectionRef} className="relative min-h-[calc(100svh-7rem)] overflow-hidden bg-[var(--ink)] text-white">
      <motion.div className="absolute -inset-y-16 inset-x-0" style={reduceMotion ? undefined : { y: imageY, scale: imageScale }}>
        <Image
          src={editorialMedia.hero.src}
          alt={editorialMedia.hero.alt}
          fill
          sizes="100vw"
          className="object-cover object-[55%_55%]"
          priority
          loading="eager"
          fetchPriority="high"
        />
      </motion.div>
      {presentationMode && (
        <div className="hero-video absolute inset-0">
          <video
            ref={videoRef}
            data-hero-video
            src={heroVideo.src}
            poster={heroVideo.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            tabIndex={-1}
            aria-hidden="true"
            className="h-full w-full object-cover object-center"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,12,9,.93)_0%,rgba(16,12,9,.68)_38%,rgba(16,12,9,.12)_72%),linear-gradient(0deg,rgba(16,12,9,.72),transparent_55%)]" />
      <div className="container-shell relative z-10 flex min-h-[calc(100svh-7rem)] flex-col justify-end py-12 md:py-16">
        <div>
          <p className="hero-enter hero-enter-1 eyebrow text-[var(--rawhide)]">Paysandú · Uruguay</p>
          <h1 className="hero-enter hero-enter-2 display-xl mt-7">Una tradición que llega a vos.</h1>
          <p className="hero-enter hero-enter-3 mt-7 max-w-xl text-base leading-8 text-white/75 md:text-lg">Mates, cuero y metal trabajados para acompañar historias, viajes, reuniones y rituales cotidianos.</p>
          <div className="hero-enter hero-enter-4 mt-9 flex flex-col gap-3 sm:flex-row">
            <Link className="button-primary" href="/catalogo">Explorar catálogo</Link>
            <Link className="button-light" href="/personalizados">Conocer personalizados</Link>
          </div>
        </div>
        <div className="hero-enter hero-enter-5 mt-14 flex max-w-3xl flex-wrap gap-x-8 gap-y-3 border-t border-white/25 pt-5 text-[0.7rem] font-medium tracking-[0.14em] text-white/60 uppercase">
          <span>Fabricación artesanal</span><span>Venta nacional</span><span>Envíos internacionales</span>
        </div>
      </div>
    </section>
  );
}
