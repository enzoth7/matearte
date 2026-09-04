"use client";

import { Pause, Play } from "@phosphor-icons/react";
import { AE, AR, AU, BR, CL, CR, DE, ES, FR, GB, HN, IT, MX, PY, RU, SG, US, UY } from "country-flag-icons/react/3x2";
import { useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { CustomerTestimonial, TestimonialCountryCode } from "@/data/international-clients";

type TestimonialCardProps = Pick<CustomerTestimonial, "quote" | "authorName" | "authorTitle" | "countryCode">;

type ScrollerRow = {
  id: string;
  speed: string;
  direction: "left" | "right";
  testimonials: readonly CustomerTestimonial[];
};

type TestimonialsSectionProps = {
  data: {
    title: string;
    subtitle: string;
    rows: readonly ScrollerRow[];
  };
};

type ScrollerStyle = CSSProperties & { "--scroll-duration": string };

const flagComponents = { AE, AR, AU, BR, CL, CR, DE, ES, FR, GB, HN, IT, MX, PY, RU, SG, US, UY } satisfies Record<TestimonialCountryCode, typeof AR>;
const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function CountryFlag({ code, label }: { code: TestimonialCountryCode; label: string }) {
  const t = useTranslations("customersPage");
  const Flag = flagComponents[code];
  return <Flag className="testimonial-flag" role="img" aria-label={t("flagLabel", { country: label })} />;
}

export function TestimonialCard({ quote, authorName, authorTitle, countryCode }: TestimonialCardProps) {
  return (
    <blockquote className="testimonial-card">
      <p>“{quote}”</p>
      <footer>
        <CountryFlag code={countryCode} label={authorTitle} />
        <span>
          <strong>{authorName}</strong>
          <small>{authorTitle}</small>
        </span>
      </footer>
    </blockquote>
  );
}

export function HorizontalScroller({ children, speed = "64s", direction = "left", paused = false }: { children: ReactNode; speed?: string; direction?: "left" | "right"; paused?: boolean }) {
  const t = useTranslations("customersPage");
  return (
    <div className="testimonial-scroller" data-paused={paused || undefined} role="region" aria-label={t("carouselLabel", { direction: t(direction === "left" ? "left" : "right") })} tabIndex={0}>
      <div className={`testimonial-track testimonial-track--${direction}`} style={{ "--scroll-duration": speed } as ScrollerStyle}>
        <div className="testimonial-run">{children}</div>
        <div className="testimonial-run" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}

export default function TestimonialsSection({ data }: TestimonialsSectionProps) {
  const t = useTranslations("customersPage");
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
            <p className="eyebrow text-[var(--rawhide)]">{t("voices")}</p>
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
              {prefersReducedMotion ? t("reducedMotion") : paused ? t("resumeCarousel") : t("pauseCarousel")}
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
    </section>
  );
}
