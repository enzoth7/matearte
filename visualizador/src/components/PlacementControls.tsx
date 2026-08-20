import type { ElementTransform } from "../types/customizer";

interface PlacementControlsProps {
  label: string;
  value: ElementTransform;
  onChange: (value: ElementTransform) => void;
  inverted?: boolean;
  onToggleInvert?: () => void;
  showInvertToggle?: boolean;
}

export function PlacementControls({
  label,
  value,
  onChange,
  inverted = false,
  onToggleInvert,
  showInvertToggle = false,
}: PlacementControlsProps) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-[#e7d7c1] bg-white p-3">
      <legend className="px-1 text-[10px] font-bold uppercase tracking-widest text-[#5f3826]">
        Ajustes de {label}
      </legend>
      <p className="text-[10px] leading-relaxed text-[#5f3826]/70">
        Arrastrá el elemento para moverlo o ajustá su tamaño y rotación.
      </p>

      {showInvertToggle && onToggleInvert && (
        <div className="flex items-center justify-between rounded-lg border border-[#e7d7c1]/70 bg-[#fbf3de]/40 px-2.5 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#5f3826]">
            Curvatura / Dirección
          </span>
          <button
            type="button"
            onClick={onToggleInvert}
            className="flex items-center gap-1.5 rounded-lg border border-[#7a4a31] bg-white px-2.5 py-1 text-xs font-bold text-[#7a4a31] shadow-xs transition-all hover:bg-[#7a4a31] hover:text-white cursor-pointer active:scale-95"
          >
            <span className="text-sm font-bold leading-none">{inverted ? "⌣" : "⌒"}</span>
            <span className="text-[11px]">{inverted ? "Invertida (Abajo)" : "Normal (Arriba)"}</span>
          </button>
        </div>
      )}

      <label className="block text-[10px] font-bold uppercase tracking-wide text-[#5f3826]">
        Tamaño: {Math.round(value.scale * 100)}%
        <input
          type="range"
          min="0.5"
          max="1.6"
          step="0.05"
          value={value.scale}
          onChange={(event) => onChange({ ...value, scale: Number(event.target.value) })}
          className="mt-2 block min-h-11 w-full accent-[#7a4a31]"
        />
      </label>

      <label className="block text-[10px] font-bold uppercase tracking-wide text-[#5f3826]">
        Rotación: {Math.round(value.rotation)}°
        <input
          type="range"
          min="-180"
          max="180"
          step="5"
          value={value.rotation}
          onChange={(event) => onChange({ ...value, rotation: Number(event.target.value) })}
          className="mt-2 block min-h-11 w-full accent-[#7a4a31]"
        />
      </label>
    </fieldset>
  );
}

