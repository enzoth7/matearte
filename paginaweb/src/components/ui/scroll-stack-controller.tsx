"use client";

import { useEffect } from "react";

const STACK_TOP_PX = 80;

export function ScrollStackController() {
  useEffect(() => {
    const layers = Array.from(document.querySelectorAll<HTMLElement>(".scroll-stack-layer"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactLandscape = window.matchMedia("(max-height: 640px) and (orientation: landscape)");
    let animationFrame = 0;

    const updateModes = () => {
      const disabled = reducedMotion.matches || compactLandscape.matches;
      const availableHeight = window.innerHeight - STACK_TOP_PX;

      layers.forEach((layer) => {
        if (disabled) {
          layer.dataset.stackMode = "none";
          layer.style.removeProperty("--stack-offset");
          return;
        }

        const isTall = layer.offsetHeight > availableHeight;
        layer.dataset.stackMode = isTall ? "tall" : "top";
        layer.style.setProperty("--stack-offset", `${isTall ? window.innerHeight - layer.offsetHeight : STACK_TOP_PX}px`);
      });
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateModes);
    };

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    layers.forEach((layer) => resizeObserver.observe(layer));
    reducedMotion.addEventListener("change", scheduleUpdate);
    compactLandscape.addEventListener("change", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      reducedMotion.removeEventListener("change", scheduleUpdate);
      compactLandscape.removeEventListener("change", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      layers.forEach((layer) => {
        delete layer.dataset.stackMode;
        layer.style.removeProperty("--stack-offset");
      });
    };
  }, []);

  return null;
}
