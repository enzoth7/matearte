import { rimIconCatalog } from "../catalog/rimIconCatalog";
import type { IconElement } from "../types/customizer";

interface VirolaIconSelectorProps {
  icons: IconElement[];
  onChange: (icons: IconElement[]) => void;
}

export function VirolaIconSelector({ icons, onChange }: VirolaIconSelectorProps) {
  if (rimIconCatalog.length === 0) return <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[10px] text-zinc-500">No hay imágenes disponibles en la biblioteca.</p>;

  const handleAdd = (imageId: string) => {
    if (icons.length >= 3) return;
    onChange([...icons, {
      id: crypto.randomUUID(),
      selectedImageId: imageId,
      customImage: null,
      transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, side: "rim" }
    }]);
  };

  const handleRemove = (id: string) => {
    onChange(icons.filter(icon => icon.id !== id));
  };

  return (
    <div className="space-y-4">
      {icons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {icons.map((icon) => {
            const catalogItem = icon.customImage ? null : rimIconCatalog.find(item => item.id === icon.selectedImageId);
            const src = icon.customImage?.previewUrl ?? catalogItem?.src;
            return (
              <div key={icon.id} className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#7a4a31] bg-[#fbf3de] p-2">
                {src ? <img src={src} alt="" className="h-full w-full object-contain" draggable={false} /> : <span className="text-xs">?</span>}
                <button
                  type="button"
                  onClick={() => handleRemove(icon.id)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700 shadow-sm hover:bg-red-200"
                  aria-label="Eliminar ícono"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto pr-1">
        {rimIconCatalog.map((icon) => (
          <button 
            key={icon.id} 
            type="button" 
            onClick={() => handleAdd(icon.id)} 
            disabled={icons.length >= 3}
            title={icon.name} 
            aria-label={icon.name} 
            className="flex aspect-square min-h-11 min-w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white p-2 transition-all hover:border-[#7a4a31] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <img src={icon.src} alt="" className="h-full w-full object-contain" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  );
}
