import { useState } from "react";
import { rimFinishCatalog, type RimFinishId } from "../catalog/rimFinishCatalog";

interface RimFinishSelectorProps {
  selectedFinishId: RimFinishId;
  onSelect: (finishId: RimFinishId) => void;
}

export function RimFinishSelector({ selectedFinishId, onSelect }: RimFinishSelectorProps) {
  const [failedImages, setFailedImages] = useState<RimFinishId[]>([]);

  return (
    <div>
      <span className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-zinc-400">Terminación</span>
      <div className="grid grid-cols-3 gap-2">
        {rimFinishCatalog.map((finish) => {
          const isSelected = finish.id === selectedFinishId;
          return (
            <button key={finish.id} type="button" onClick={() => onSelect(finish.id)} aria-pressed={isSelected} className={`overflow-hidden rounded-xl border p-2 text-center transition-all ${isSelected ? "border-[#2b3e13] bg-[#2b3e13]/5 text-[#2b3e13] ring-1 ring-[#2b3e13]/25" : "border-zinc-200 bg-white text-zinc-700 hover:border-[#7a4a31]"}`}>
              <span className="mb-1.5 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-[8px] font-bold uppercase tracking-wider text-zinc-400">
                {failedImages.includes(finish.id) ? "Sin preview" : <img src={finish.image} alt="" className="h-full w-full object-contain" onError={() => setFailedImages((current) => current.includes(finish.id) ? current : [...current, finish.id])} draggable={false} />}
              </span>
              <span className="block text-[9px] font-bold leading-tight">{finish.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
