import { rimIconCatalog } from "../catalog/rimIconCatalog";
import type { IconElement } from "../types/customizer";

interface VirolaIconSelectorProps {
  icons: IconElement[];
  onChange: (icons: IconElement[]) => void;
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  limit?: number;
}

export function VirolaIconSelector({ icons, onChange, selectedElementId, onSelectElement, limit = 3 }: VirolaIconSelectorProps) {
  if (rimIconCatalog.length === 0) return <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[10px] text-zinc-500">No hay imágenes disponibles en la biblioteca.</p>;

  const getInitialPosition = (count: number) => {
    const angles = [90, 45, 135];
    const angle = angles[count] ?? 90;
    const rad = angle * (Math.PI / 180);
    return {
      x: Math.round((0.5 + Math.cos(rad) * 0.378) * 1000) / 1000,
      y: Math.round((0.5 + Math.sin(rad) * 0.378) * 1000) / 1000,
    };
  };

  const handleToggle = (imageId: string) => {
    const selectedIcon = icons.find((icon) => !icon.customImage && icon.selectedImageId === imageId);
    if (selectedIcon) {
      onChange(icons.filter((icon) => icon.id !== selectedIcon.id));
      if (selectedElementId === selectedIcon.id) onSelectElement?.(null);
      return;
    }
    if (icons.length >= limit) return;
    const pos = getInitialPosition(icons.length);
    const newId = crypto.randomUUID();
    onChange([...icons, {
      id: newId,
      selectedImageId: imageId,
      customImage: null,
      transform: { x: pos.x, y: pos.y, scale: 1, rotation: 0, side: "rim" }
    }]);
    onSelectElement?.(newId);
  };

  return (
    <div className="space-y-3">
      <div className="virola-icon-grid">
        {rimIconCatalog.map((icon) => {
          const isSelected = icons.some((selected) => !selected.customImage && selected.selectedImageId === icon.id);
          return (
            <button
              key={icon.id}
              type="button"
              onClick={() => handleToggle(icon.id)}
              disabled={!isSelected && icons.length >= limit}
              title={isSelected ? `Quitar ${icon.name}` : icon.name}
              aria-label={isSelected ? `${icon.name}, seleccionado. Pulsá para quitarlo` : icon.name}
              aria-pressed={isSelected}
              className="virola-icon-option"
            >
              <img src={icon.src} alt="" draggable={false} />
              {isSelected && <span className="virola-icon-option__check" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
