import type { RimOption } from "../catalog/rimCatalog";

interface RimMaterialSelectorProps {
  rims: RimOption[];
  selectedRimId: string;
  onSelect: (rimId: string) => void;
}

export function RimMaterialSelector({ rims, selectedRimId, onSelect }: RimMaterialSelectorProps) {
  return (
    <div>
      <span className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-zinc-400">Tipo de virola</span>
      <div className="grid grid-cols-2 gap-2">
        {rims.map((rim) => {
          const isSelected = rim.id === selectedRimId;
          return <button key={rim.id} type="button" onClick={() => onSelect(rim.id)} aria-pressed={isSelected} className={`min-h-11 rounded-xl border px-3 py-2.5 text-[10px] font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a4a31] ${isSelected ? "border-[#2b3e13] bg-[#2b3e13]/5 text-[#2b3e13] ring-1 ring-[#2b3e13]/25" : "border-zinc-200 bg-white text-zinc-700 hover:border-[#7a4a31]"}`}>{rim.shortName}</button>;
        })}
      </div>
    </div>
  );
}
