"use client";

import { Pause, Play } from "@phosphor-icons/react";
import { AR, BR, CL, CR, ES, FR, GB, HN, IT, MX, RU, SG, US } from "country-flag-icons/react/3x2";
import { useReducedMotion } from "motion/react";
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { DemoTestimonial, DestinationCode } from "@/data/international-clients";

type TestimonialCardProps = Pick<DemoTestimonial, "quote" | "authorName" | "authorTitle" | "countryCode">;

type ScrollerRow = {
  id: string;
  speed: string;
  direction: "left" | "right";
  testimonials: readonly DemoTestimonial[];
};

type TestimonialsSectionProps = {
  data: {
    title: string;
    subtitle: string;
    rows: readonly ScrollerRow[];
  };
};

type ScrollerStyle = CSSProperties & { "--scroll-duration": string };

const flagComponents = { AR, BR, CL, CR, ES, FR, GB, HN, IT, MX, RU, SG, US } satisfies Record<DestinationCode, typeof AR>;
const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function CountryFlag({ code, label }: { code: DestinationCode; label: string }) {
  const Flag = flagComponents[code];
  return <Flag className="testimonial-flag" role="img" aria-label={`Bandera de ${label}`} />;
}

export function TestimonialCard({ quote, authorName, authorTitle, countryCode }: TestimonialCardProps) {
  const countryName = authorTitle.split(", ").at(-1) ?? authorTitle;
  return (
    <blockquote className="testimonial-card">
      <p>“{quote}”</p>
      <footer>
        <CountryFlag code={countryCode} label={countryName} />
        <span>
          <strong>{authorName}</strong>
          <small>{authorTitle} · muestra</small>
        </span>
      </footer>
    </blockquote>
  );
}

export function HorizontalScroller({ children, speed = "64s", direction = "left", paused = false }: { children: ReactNode; speed?: string; direction?: "left" | "right"; paused?: boolean }) {
  return (
    <div className="testimonial-scroller" data-paused={paused || undefined} role="region" aria-label={`Carrusel de testimonios, movimiento hacia la ${direction === "left" ? "izquierda" : "derecha"}`} tabIndex={0}>
      <div className={`testimonial-track testimonial-track--${direction}`} style={{ "--scroll-duration": speed } as ScrollerStyle}>
        <div className="testimonial-run">{children}</div>
        <div className="testimonial-run" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}

export default function TestimonialsSection({ data }: TestimonialsSectionProps) {
  const reduceMotion = useReducedMotion();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = hydrated && Boolean(reduceMotion);
  const motionStopped = paused || prefersReducedMotion;

  return (
    <section className="testimonials-section" aria-labelledby="testimonials-heading">
      <div className="container-shell">
        <div className="testimonials-heading-grid">
          <div>
            <p className="eyebrow text-[var(--rawhide)]">Voces alrededor del mundo</p>
            <h2 id="testimonials-heading" className="display-lg mt-7 text-[var(--paper)]">{data.title}</h2>
          </div>
          <div className="testimonials-heading-copy">
            <p>{data.subtitle}</p>
            <button
              type="button"
              className="testimonial-motion-control"
              onClick={() => setPaused((value) => !value)}
              disabled={prefersReducedMotion}
              aria-pressed={motionStopped}
            >
              {motionStopped ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
              {prefersReducedMotion ? "Movimiento reducido" : paused ? "Reanudar carrusel" : "Pausar carrusel"}
            </button>
          </div>
        </div>
      </div>

      <div className="testimonial-rows">
        {data.rows.map((row) => (
          <HorizontalScroller key={row.id} speed={row.speed} direction={row.direction} paused={motionStopped}>
            {row.testimonials.map((testimonial) => <TestimonialCard key={testimonial.id} {...testimonial} />)}
          </HorizontalScroller>
        ))}
      </div>

      <div className="container-shell">
        <p className="testimonial-demo-note"><strong>Contenido demostrativo.</strong> Estos 20 perfiles y textos son ficticios para esta presentación. Antes de publicar deben reemplazarse por testimonios reales, autorizados y verificables.</p>
      </div>
    </section>
  );
}
