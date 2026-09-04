"use client";

import { MotionConfig, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";

const assets = "/assets/matearte/home-v2";

export function HomeHero() {
  const t = useTranslations("home");
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();

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
    <MotionConfig reducedMotion="user">
      <section className="home-hero" aria-labelledby="home-hero-title">
        <motion.div
          className="home-hero-media"
          initial={reduceMotion ? false : { opacity: 0.25, scaleX: 1.04, scaleY: 1.04 }}
          animate={reduceMotion ? undefined : { opacity: [0.25, 0.25, 1, 1], scaleX: [1.04, 1.04, 1, 1], scaleY: [1.04, 1.04, 1, 1] }}
          transition={reduceMotion ? undefined : {
            opacity: { duration: 2, times: [0, 0.04, 0.36, 1], ease: ["linear", "easeOut", "linear"], repeat: Infinity },
            scaleX: { duration: 2, times: [0, 0.04, 0.36, 1], ease: ["linear", "easeOut", "linear"], repeat: Infinity },
            scaleY: { duration: 2, times: [0, 0.04, 0.36, 1], ease: ["linear", "easeOut", "linear"], repeat: Infinity },
          }}
        >
          <Image src={`${assets}/hero-overlay.png`} alt={t("heroAlt")} fill sizes="100vw" className="home-hero-poster" priority />
          <video ref={videoRef} className="home-hero-video" src={`${assets}/hero-segment.mp4`} poster={`${assets}/hero-poster.jpg`} autoPlay muted loop playsInline preload="metadata" tabIndex={-1} aria-hidden="true" />
        </motion.div>
        <div className="home-hero-scrim" />
        <motion.div
          className="home-hero-content"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={reduceMotion ? undefined : { opacity: [0, 1, 1], y: [18, 0, 0] }}
          transition={reduceMotion ? undefined : {
            opacity: { duration: 2, times: [0, 0.275, 1], ease: ["easeOut", "linear"], repeat: Infinity },
            y: { duration: 2, times: [0, 0.275, 1], ease: ["easeOut", "linear"], repeat: Infinity },
          }}
        >
          <h1 id="home-hero-title"><span>{t("heroLine1")}</span><span>{t("heroLine2")}</span></h1>
          <p>{t("heroBody")}</p>
          <div className="home-hero-actions">
            <Link className="home-button home-button-dark" href="/catalogo">{t("viewMates")}</Link>
            <Link className="home-button home-button-light" href="/personalizados">{t("createMine")}</Link>
          </div>
        </motion.div>
      </section>
    </MotionConfig>
  );
}
