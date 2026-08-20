import type { RimImageMode } from "../catalog/rimCatalog";

interface RimImageModeSelectorProps {
  mode: RimImageMode;
  onSelect: (mode: RimImageMode) => void;
}

export function RimImageModeSelector({ mode, onSelect }: RimImageModeSelectorProps) {
  const active = mode === "image";
  return (
    <button type="button" className="brand-mode-toggle" aria-label={active ? "Desactivar íconos" : "Activar íconos"} aria-pressed={active} onClick={() => onSelect(active ? "none" : "image")}>
      <span className="brand-switch" aria-hidden="true"><span /></span>
    </button>
  );
}
