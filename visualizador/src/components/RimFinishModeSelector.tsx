export type RimFinishMode = "none" | "finish";

interface RimFinishModeSelectorProps {
  mode: RimFinishMode;
  onSelect: (mode: RimFinishMode) => void;
}

export function RimFinishModeSelector({ mode, onSelect }: RimFinishModeSelectorProps) {
  const active = mode === "finish";
  return (
    <button type="button" className="brand-mode-toggle" aria-label={active ? "Desactivar terminación" : "Activar terminación"} aria-pressed={active} aria-expanded={active} onClick={() => onSelect(active ? "none" : "finish")}>
      <span className="brand-switch" aria-hidden="true"><span /></span>
    </button>
  );
}
