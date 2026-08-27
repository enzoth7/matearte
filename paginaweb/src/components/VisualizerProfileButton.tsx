"use client";

import { ArrowSquareOut } from "@phosphor-icons/react";
import { useState } from "react";

export function VisualizerProfileButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const openDesigns = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/visualizer-handoff", { method: "POST" });
      const value = await response.json().catch(() => ({})) as { redirectUrl?: unknown; error?: unknown };
      if (!response.ok || typeof value.redirectUrl !== "string") {
        throw new Error(typeof value.error === "string" ? value.error : "No pudimos abrir tus diseños.");
      }
      window.location.assign(value.redirectUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos abrir tus diseños.");
      setBusy(false);
    }
  };

  return (
    <span className="flex flex-col items-start gap-2">
      <button type="button" onClick={() => void openDesigns()} disabled={busy} className="button-secondary gap-2 disabled:cursor-wait disabled:opacity-55">
        {busy ? "Conectando cuenta…" : "Ver mis diseños"}
        <ArrowSquareOut size={18} aria-hidden="true" />
      </button>
      {error && <span role="alert" className="max-w-64 text-xs leading-5 text-[var(--danger)]">{error} Probá nuevamente.</span>}
    </span>
  );
}
