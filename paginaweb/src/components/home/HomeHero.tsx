"use client";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
const slides = [
  {
    key: "champions",
    image: "hero-champions-enhanced.webp",
    href: { pathname: "/catalogo", query: { coleccion: "uruguay" } },
    action: "collection",
  },
  {
    key: "custom",
    image: "hero-custom.webp",
    href: "/personalizados",
    action: "custom",
  },
  {
    key: "leather",
    image: "hero-leather.webp",
    href: "/catalogo",
    action: "catalog",
  },
  {
    key: "tradition",
    image: "hero-tradition.webp",
    href: "/catalogo",
    action: "catalog",
  },
] as const;
export function HomeHero() {
  const t = useTranslations("home.carousel");
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const reduceMotion = useReducedMotion();
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (paused || hovered || focused || !visible || reduceMotion) return;
    const timer = window.setTimeout(
      () => setActive((value) => (value + 1) % slides.length),
      5000,
    );
    return () => window.clearTimeout(timer);
  }, [active, paused, hovered, focused, visible, reduceMotion]);
  const select = (index: number) => {
    setActive(index);
    setPaused(true);
  };
  return (
    <section
      className="home-carousel"
      aria-roledescription={t("carousel")}
      aria-label={t("label")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      onTouchStart={(event) => {
        setPaused(true);
        const point = event.touches[0];
        touch.current = { x: point.clientX, y: point.clientY };
      }}
      onTouchEnd={(event) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const point = event.changedTouches[0];
        const dx = point.clientX - start.x;
        if (
          Math.abs(dx) > 50 &&
          Math.abs(dx) > Math.abs(point.clientY - start.y)
        )
          select((active + (dx < 0 ? 1 : slides.length - 1)) % slides.length);
      }}
    >
      {slides.map((slide, index) => (
        <article
          key={slide.key}
          id={`hero-${slide.key}`}
          className={`home-carousel-slide home-carousel-${slide.key}`}
          data-active={index === active}
          aria-hidden={index !== active}
          inert={index !== active}
        >
          <Image
            src={`/assets/matearte/home-v2/${slide.image}`}
            alt={t(`${slide.key}.alt`)}
            fill
            sizes="100vw"
            unoptimized={slide.key === "champions"}
            preload={index === 0}
            loading={index === 0 ? undefined : "eager"}
          />
          <div className="home-carousel-shade" />
          <div className="home-carousel-copy">
            {slide.key === "champions" ? (
              <h1>{t("champions.title")}</h1>
            ) : slide.key !== "tradition" ? (
              <h2>{t(`${slide.key}.title`)}</h2>
            ) : null}
            <Link
              className="home-button home-carousel-action"
              href={slide.href}
            >
              {t(`actions.${slide.action}`)}
            </Link>
          </div>
        </article>
      ))}
      <div className="home-carousel-controls">
        <nav aria-label={t("choose")}>
          {slides.map((slide, index) => (
            <button
              key={slide.key}
              type="button"
              aria-controls={`hero-${slide.key}`}
              aria-current={active === index ? "true" : undefined}
              onClick={() => select(index)}
            >
              {t(`${slide.key}.label`)}
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}
