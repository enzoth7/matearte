"use client";

import { ArrowSquareOut } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function VisualizerProfileButton({ label }: { label?: string }) {
  const t = useTranslations("visualizer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const openDesigns = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/visualizer-handoff", { method: "POST" });
      const value = await response.json().catch(() => ({})) as { redirectUrl?: unknown; error?: unknown };
      if (!response.ok || typeof value.redirectUrl !== "string") {
        throw new Error(t("openFailed"));
      }
      window.location.assign(value.redirectUrl);
    } catch (reason) {
      console.error("Visualizer handoff failed", reason);
      setError(t("openFailed"));
      setBusy(false);
    }
  };

  return (
    <span className="flex flex-col items-start gap-2">
      <button type="button" onClick={() => void openDesigns()} disabled={busy} className="button-secondary gap-2 disabled:cursor-wait disabled:opacity-55">
        {busy ? t("connecting") : (label || t("myDesigns"))}
        <ArrowSquareOut size={18} aria-hidden="true" />
      </button>
      {error && <span role="alert" className="max-w-64 text-xs leading-5 text-[var(--danger)]">{error}</span>}
    </span>
  );
}
