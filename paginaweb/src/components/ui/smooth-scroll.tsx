"use client";

import { ReactLenis, type LenisRef, useLenis } from "lenis/react";
import { useReducedMotion } from "motion/react";
import { forwardRef, useEffect, useMemo, type ReactNode } from "react";

interface SmoothScrollProps {
  children: ReactNode;
}

function ScrollInteractionGuard() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    const settleScroll = () => {
      if (!lenis.isScrolling) return;
      lenis.stop();
      lenis.start();
    };

    window.addEventListener("pointerdown", settleScroll, { capture: true });
    return () => window.removeEventListener("pointerdown", settleScroll, { capture: true });
  }, [lenis]);

  return null;
}

const SmoothScroll = forwardRef<LenisRef, SmoothScrollProps>(({ children }, ref) => {
  const reduceMotion = useReducedMotion();

  const options = useMemo(
    () => ({
      autoRaf: true,
      anchors: !reduceMotion,
      duration: 1.05,
      easing: (value: number) => Math.min(1, 1.001 - 2 ** (-10 * value)),
      smoothWheel: !reduceMotion,
      stopInertiaOnNavigate: true,
      syncTouch: false,
    }),
    [reduceMotion],
  );

  return (
    <ReactLenis ref={ref} root options={options}>
      <ScrollInteractionGuard />
      {children}
    </ReactLenis>
  );
});

SmoothScroll.displayName = "SmoothScroll";

export default SmoothScroll;
