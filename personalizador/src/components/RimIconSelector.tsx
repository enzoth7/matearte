import { rimIconCatalog } from "../catalog/rimIconCatalog";

interface RimIconSelectorProps { selectedImageId: string | null; onSelect: (imageId: string) => void }

export function RimIconSelector({ selectedImageId, onSelect }: RimIconSelectorProps) {
  if (rimIconCatalog.length === 0) return <div data-copy className="rounded-xl border border-brand-black/18 bg-brand-black/5 px-3 py-3 text-[10px] text-brand-black/70">No hay imágenes disponibles en la biblioteca.</div>;
  return (
    <div className="fleje-icon-grid grid gap-2">
      {rimIconCatalog.map((icon) => {
        const isSelected = icon.id === selectedImageId;
        return <button key={icon.id} type="button" onClick={() => onSelect(icon.id)} title={icon.name} aria-label={icon.name} aria-pressed={isSelected} className={`flex aspect-square min-h-11 min-w-11 items-center justify-center rounded-xl border bg-brand-white p-2 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-brown ${isSelected ? "border-brand-brown bg-brand-brown/5 ring-1 ring-brand-brown/25" : "border-brand-black/18 hover:border-brand-brown"}`}><img src={icon.src} alt="" className="h-full w-full object-contain" draggable={false} /></button>;
      })}
    </div>
  );
}
