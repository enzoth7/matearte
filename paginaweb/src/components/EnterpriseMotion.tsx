"use client";

import { useEffect } from "react";
import styles from "@/app/empresas/EmpresasPage.module.css";

const revealSelector = "[data-enterprise-reveal]";

export function EnterpriseMotion() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".empresas-page");
    if (!page) return;

    const items = Array.from(page.querySelectorAll<HTMLElement>(revealSelector));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    page.classList.add(styles.motionReady);

    if (reducedMotion) {
      items.forEach((item) => item.setAttribute("data-enterprise-visible", "true"));
      return () => page.classList.remove(styles.motionReady);
    }

    const introItems = items.filter((item) => item.hasAttribute("data-enterprise-intro"));
    const scrollItems = items.filter((item) => !item.hasAttribute("data-enterprise-intro"));
    const frame = window.requestAnimationFrame(() => {
      introItems.forEach((item) => item.setAttribute("data-enterprise-visible", "true"));
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).setAttribute("data-enterprise-visible", "true");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8%" },
    );

    scrollItems.forEach((item) => observer.observe(item));

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      page.classList.remove(styles.motionReady);
    };
  }, []);

  return null;
}
