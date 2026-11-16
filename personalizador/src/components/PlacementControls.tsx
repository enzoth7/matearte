import type { ElementTransform } from "../types/personalizer";

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
    <fieldset className="space-y-3 rounded-xl border border-brand-line bg-brand-white p-3">
      <legend className="px-1 text-[10px] font-bold uppercase tracking-widest text-brand-brown">
        Ajustes de {label}
      </legend>
      <div data-copy className="text-[10px] leading-relaxed text-brand-brown/70">
        Arrastrá el elemento para moverlo o ajustá su tamaño y rotación.
      </div>

      {showInvertToggle && onToggleInvert && (
        <div className="flex items-center justify-between rounded-lg border border-brand-line/70 bg-brand-white/40 px-2.5 py-2">
          <strong data-inline className="text-[10px] font-bold uppercase tracking-wide text-brand-brown">
            Curvatura / Dirección
          </strong>
          <button
            type="button"
            onClick={onToggleInvert}
            className="flex items-center gap-1.5 rounded-lg border border-brand-brown bg-brand-white px-2.5 py-1 text-xs font-bold text-brand-brown shadow-xs transition-all hover:bg-brand-brown hover:text-brand-white cursor-pointer active:scale-95"
          >
            <strong data-inline className="text-sm font-bold leading-none">{inverted ? "⌣" : "⌒"}</strong>
            <strong data-inline className="text-[11px]">{inverted ? "Invertida (Abajo)" : "Normal (Arriba)"}</strong>
          </button>
        </div>
      )}

      <label className="block text-[10px] font-bold uppercase tracking-wide text-brand-brown">
        Tamaño: {Math.round(value.scale * 100)}%
        <input
          type="range"
          min="0.5"
          max="1.6"
          step="0.05"
          value={value.scale}
          onChange={(event) => onChange({ ...value, scale: Number(event.target.value) })}
          className="mt-2 block min-h-11 w-full accent-brand-brown"
        />
      </label>

      <label className="block text-[10px] font-bold uppercase tracking-wide text-brand-brown">
        Rotación: {Math.round(value.rotation)}°
        <input
          type="range"
          min="-180"
          max="180"
          step="5"
          value={value.rotation}
          onChange={(event) => onChange({ ...value, rotation: Number(event.target.value) })}
          className="mt-2 block min-h-11 w-full accent-brand-brown"
        />
      </label>
    </fieldset>
  );
}

