import type { RimTextMode } from "../catalog/rimCatalog";

interface RimTextModeSelectorProps {
  mode: RimTextMode;
  onSelect: (mode: RimTextMode) => void;
}

export function RimTextModeSelector({ mode, onSelect }: RimTextModeSelectorProps) {
  const options: Array<{ id: RimTextMode; label: string }> = [
    { id: "none", label: "Sin texto" },
    { id: "text", label: "Con texto" },
  ];
  return (
    <div>
      <span className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-zinc-400">Texto</span>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-pressed={option.id === mode}
            className={`min-h-11 rounded-xl border px-3 py-2.5 text-[10px] font-bold transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a4a31] ${
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
