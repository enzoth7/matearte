"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

const assets = "/assets/matearte/nosotros-desktop";

type NosotrosHeroProps = {
  variant?: "desktop" | "mobile";
};

export function NosotrosHero({ variant = "desktop" }: NosotrosHeroProps) {
  const t = useTranslations("aboutPage");
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();
  const isMobile = variant === "mobile";
  const classPrefix = isMobile ? "nosotros-mobile" : "nosotros-desktop";
  const titleId = `${classPrefix}-title`;

  useEffect(() => {
    const viewport = window.matchMedia(isMobile ? "(max-width: 1023px)" : "(min-width: 1024px)");
    const video = videoRef.current;
    if (!video) return;

    const updatePlayback = () => {
      if (viewport.matches && !reduceMotion) {
        video.play().catch(() => undefined);
        return;
      }

      video.pause();
      video.currentTime = 0;
    };

    updatePlayback();
    viewport.addEventListener("change", updatePlayback);
    return () => viewport.removeEventListener("change", updatePlayback);
  }, [isMobile, reduceMotion]);

  return (
    <section className={`${classPrefix}-hero`} aria-labelledby={titleId}>
      <div className={`${classPrefix}-hero-media`} aria-hidden="true">
        <Image src={`${assets}/hero-poster.jpg`} alt="" fill sizes="100vw" priority />
        <video
          ref={videoRef}
          src={`${assets}/hero-segment.mp4?v=12s`}
          poster={`${assets}/hero-poster.jpg`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
        />
      </div>
      <div className={`${classPrefix}-hero-scrim`} aria-hidden="true" />
      <div className={`${classPrefix}-hero-content`}>
        <h1 id={titleId}>
          <span>{t("heroLine1")}</span>
          <span>{t("heroLine2")}</span>
        </h1>
        <p>{t("heroBody")}</p>
      </div>
    </section>
  );
}
