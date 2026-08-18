import type { ElementTransform } from "../types/customizer";

interface PlacementControlsProps {
  label: string;
  value: ElementTransform;
  onChange: (value: ElementTransform) => void;
}


export function PlacementControls({ label, value, onChange }: PlacementControlsProps) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-[#e7d7c1] bg-white p-3">
      <legend className="px-1 text-[10px] font-bold uppercase tracking-widest text-[#5f3826]">Ajustes de {label}</legend>
      <p className="text-[10px] leading-relaxed text-[#5f3826]/70">Arrastrá el elemento sobre la virola para moverlo.</p>

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

