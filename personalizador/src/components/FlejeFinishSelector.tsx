import { useState } from "react";
import { flejeFinishCatalog, type FlejeFinishId } from "../catalog/flejeFinishCatalog";

interface FlejeFinishSelectorProps {
  selectedFinishId: FlejeFinishId;
  onSelect: (finishId: FlejeFinishId) => void;
}

export function FlejeFinishSelector({ selectedFinishId, onSelect }: FlejeFinishSelectorProps) {
  const [failedImages, setFailedImages] = useState<FlejeFinishId[]>([]);

  return (
    <div>
      <div className="fleje-finish-grid grid gap-2">
        {flejeFinishCatalog.map((finish) => {
          const isSelected = finish.id === selectedFinishId;
          return (
            <button key={finish.id} type="button" onClick={() => onSelect(finish.id)} aria-pressed={isSelected} className={`overflow-hidden rounded-xl border p-2 text-center transition-all ${isSelected ? "border-brand-brown bg-brand-brown/5 text-brand-brown ring-1 ring-brand-brown/25" : "border-brand-black/18 bg-brand-white text-brand-black hover:border-brand-brown"}`}>
              <strong data-inline className="mb-1.5 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-brand-black/5 text-[8px] font-bold uppercase tracking-wider text-brand-black/70">
                {failedImages.includes(finish.id) ? "Sin preview" : <img src={finish.image} alt="" className="h-full w-full object-contain" onError={() => setFailedImages((current) => current.includes(finish.id) ? current : [...current, finish.id])} draggable={false} />}
              </strong>
              <strong data-inline className="block text-[9px] font-bold leading-tight">{finish.name}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}
