import type { RimImageMode } from "../catalog/rimCatalog";

interface RimImageModeSelectorProps {
  mode: RimImageMode;
  onSelect: (mode: RimImageMode) => void;
}

export function RimImageModeSelector({ mode, onSelect }: RimImageModeSelectorProps) {
  const options: Array<{ id: RimImageMode; label: string }> = [
    { id: "none", label: "Sin imagen" },
    { id: "image", label: "Con imagen" },
  ];
  return (
    <div>
      <span className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-zinc-400">Imagen</span>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-pressed={option.id === mode}
            className={`rounded-xl border px-3 py-2.5 text-[10px] font-bold transition-all cursor-pointer ${
              option.id === mode
                ? "border-[#7a4a31] bg-[#7a4a31]/5 text-[#7a4a31] ring-1 ring-[#7a4a31]/25 font-black"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-[#7a4a31]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
