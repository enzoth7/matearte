import type { RimTextMode } from "../catalog/rimCatalog";

interface RimTextModeSelectorProps {
  mode: RimTextMode;
  onSelect: (mode: RimTextMode) => void;
}

export function RimTextModeSelector({ mode, onSelect }: RimTextModeSelectorProps) {
  const active = mode === "text";
  return (
    <button type="button" className="brand-mode-toggle" aria-label={active ? "Desactivar texto" : "Activar texto"} aria-pressed={active} aria-expanded={active} onClick={() => onSelect(active ? "none" : "text")}>
      <strong data-inline className="brand-switch" aria-hidden="true"><strong data-inline /></strong>
    </button>
  );
}
