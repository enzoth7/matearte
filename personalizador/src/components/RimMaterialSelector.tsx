import type { RimOption } from "../catalog/rimCatalog";

interface RimMaterialSelectorProps {
  rims: RimOption[];
  selectedRimId: string;
  onSelect: (rimId: string) => void;
}

export function RimMaterialSelector({ rims, selectedRimId, onSelect }: RimMaterialSelectorProps) {
  return (
    <div>
      <strong data-inline className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-brand-black/70">Tipo de virola</strong>
      <div className="grid grid-cols-2 gap-2">
        {rims.map((rim) => {
          const isSelected = rim.id === selectedRimId;
          return <button key={rim.id} type="button" onClick={() => onSelect(rim.id)} aria-pressed={isSelected} className={`min-h-11 rounded-xl border px-3 py-2.5 text-[10px] font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-brown ${isSelected ? "border-brand-brown bg-brand-brown/5 text-brand-brown ring-1 ring-brand-brown/25" : "border-brand-black/18 bg-brand-white text-brand-black hover:border-brand-brown"}`}>{rim.shortName}</button>;
        })}
      </div>
    </div>
  );
}
