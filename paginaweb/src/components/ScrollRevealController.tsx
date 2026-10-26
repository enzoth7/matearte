"use client";

import { useEffect } from "react";

const selector = "[data-scroll-reveal]";

export function ScrollRevealController() {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const registered = new WeakSet<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        element.removeAttribute("data-scroll-reveal-pending");
        observer.unobserve(element);
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });

    const register = (element: Element) => {
      if (registered.has(element)) return;
      registered.add(element);
      const bounds = element.getBoundingClientRect();
      // Keep content already on screen visible; only introduce motion while scrolling.
      if (!bounds.width || !bounds.height || bounds.top < window.innerHeight * 0.88 || bounds.bottom < 0) return;
      element.setAttribute("data-scroll-reveal-pending", "");
      observer.observe(element);
    };
    const registerTree = (node: Node) => {
      if (!(node instanceof Element)) return;
      if (node.matches(selector)) register(node);
      node.querySelectorAll(selector).forEach(register);
    };

    document.querySelectorAll(selector).forEach(register);
    const changes = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach(registerTree);
        record.removedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches("[data-scroll-reveal-pending]")) observer.unobserve(node);
          node.querySelectorAll("[data-scroll-reveal-pending]").forEach((element) => observer.unobserve(element));
        });
      }
    });
    changes.observe(document.body, { childList: true, subtree: true });

    const revealFocused = (event: FocusEvent) => {
      const element = (event.target as Element | null)?.closest?.("[data-scroll-reveal-pending]");
      if (!element) return;
      element.removeAttribute("data-scroll-reveal-pending");
      observer.unobserve(element);
    };
    document.addEventListener("focusin", revealFocused);

    return () => {
      changes.disconnect();
      observer.disconnect();
      document.removeEventListener("focusin", revealFocused);
      document.querySelectorAll("[data-scroll-reveal-pending]").forEach((element) => element.removeAttribute("data-scroll-reveal-pending"));
    };
  }, []);

  return null;
}
