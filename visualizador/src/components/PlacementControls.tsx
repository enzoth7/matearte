import { createDefaultElementTransform, type ElementTransform } from "../types/customizer";

interface PlacementControlsProps {
  label: string;
  value: ElementTransform;
  onChange: (value: ElementTransform) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function PlacementControls({ label, value, onChange }: PlacementControlsProps) {
  const move = (x: number, y: number) => onChange({
    ...value,
    x: clamp(value.x + x, 0.1, 0.9),
    y: clamp(value.y + y, 0.15, 0.85),
  });

  return (
    <fieldset className="space-y-3 rounded-xl border border-[#e7d7c1] bg-white p-3">
      <legend className="px-1 text-[10px] font-bold uppercase tracking-widest text-[#5f3826]">Ubicación de {label}</legend>
      <p className="text-[10px] leading-relaxed text-[#5f3826]/70">Arrastrá el elemento sobre la vista o usá estos ajustes finos.</p>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="grid grid-cols-3 gap-2" aria-label={`Mover ${label}`}>
          <span />
          <button type="button" onClick={() => move(0, -0.02)} aria-label={`Mover ${label} hacia arriba`} className="min-h-11 min-w-11 rounded-lg border border-[#e7d7c1] font-bold text-[#7a4a31] hover:bg-[#fbf3de]">↑</button>
          <span />
          <button type="button" onClick={() => move(-0.02, 0)} aria-label={`Mover ${label} hacia la izquierda`} className="min-h-11 min-w-11 rounded-lg border border-[#e7d7c1] font-bold text-[#7a4a31] hover:bg-[#fbf3de]">←</button>
          <button type="button" onClick={() => onChange({ ...value, x: 0.5, y: 0.5 })} aria-label={`Centrar ${label}`} className="min-h-11 min-w-11 rounded-lg border border-[#7a4a31] bg-[#fbf3de] text-xs font-bold text-[#7a4a31]">Centro</button>
          <button type="button" onClick={() => move(0.02, 0)} aria-label={`Mover ${label} hacia la derecha`} className="min-h-11 min-w-11 rounded-lg border border-[#e7d7c1] font-bold text-[#7a4a31] hover:bg-[#fbf3de]">→</button>
          <span />
          <button type="button" onClick={() => move(0, 0.02)} aria-label={`Mover ${label} hacia abajo`} className="min-h-11 min-w-11 rounded-lg border border-[#e7d7c1] font-bold text-[#7a4a31] hover:bg-[#fbf3de]">↓</button>
          <span />
        </div>

        <button
          type="button"
          onClick={() => onChange(createDefaultElementTransform(value.side))}
          className="min-h-11 self-end rounded-lg border border-[#e7d7c1] px-3 text-xs font-bold text-[#5f3826] hover:bg-[#fbf3de]"
        >
          Restablecer
        </button>
      </div>

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

