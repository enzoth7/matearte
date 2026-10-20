"use client";

import { Check, CopySimple } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

export function CouponCopyButton({ code, copyLabel, copiedLabel, failedLabel }: {
  code: string;
  copyLabel: string;
  copiedLabel: string;
  failedLabel: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setState("idle"), 2500);
  }

  const label = state === "copied" ? copiedLabel : state === "failed" ? failedLabel : copyLabel;
  return (
    <button
      type="button"
      className={`profile-coupon-copy${state === "copied" ? " is-copied" : ""}`}
      onClick={() => void copyCode()}
      aria-label={`${label}: ${code}`}
      title={label}
    >
      {state === "copied" ? <Check size={18} weight="bold" aria-hidden="true" /> : <CopySimple size={18} aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">{label}</span>
    </button>
  );
}
