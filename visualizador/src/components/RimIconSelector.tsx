import { rimIconCatalog } from "../catalog/rimIconCatalog";

interface RimIconSelectorProps { selectedImageId: string | null; onSelect: (imageId: string) => void }

export function RimIconSelector({ selectedImageId, onSelect }: RimIconSelectorProps) {
  if (rimIconCatalog.length === 0) return <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[10px] text-zinc-500">No hay imágenes disponibles en la biblioteca.</p>;
  return (
    <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto pr-1">
      {rimIconCatalog.map((icon) => {
        const isSelected = icon.id === selectedImageId;
        return <button key={icon.id} type="button" onClick={() => onSelect(icon.id)} title={icon.name} aria-label={icon.name} aria-pressed={isSelected} className={`flex aspect-square min-h-11 min-w-11 items-center justify-center rounded-xl border bg-white p-2 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a4a31] ${isSelected ? "border-[#2b3e13] bg-[#2b3e13]/5 ring-1 ring-[#2b3e13]/25" : "border-zinc-200 hover:border-[#7a4a31]"}`}><img src={icon.src} alt="" className="h-full w-full object-contain" draggable={false} /></button>;
      })}
    </div>
  );
}
