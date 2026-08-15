import { mateSizeLabels, type MateSize, type MateVariant } from "../catalog/mateCatalog";

interface MateOptionsSelectorProps {
  variant: MateVariant;
  selectedColorId: string;
  selectedSize: MateSize;
  onColorChange: (colorId: string) => void;
  onSizeChange: (size: MateSize) => void;
}

export function MateOptionsSelector({
  variant,
  selectedColorId,
  selectedSize,
  onColorChange,
  onSizeChange,
}: MateOptionsSelectorProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-[#e7d7c1] bg-[#fdf7e9]/70 p-3">
      <fieldset>
        <legend className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#5f3826]">Color del cuero</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {variant.colors.map((color) => {
            const selected = color.id === selectedColorId;
            return (
              <button
                key={color.id}
                type="button"
                onClick={() => onColorChange(color.id)}
                aria-pressed={selected}
                className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a4a31] ${
                  selected ? "border-[#7a4a31] bg-white text-[#5f3826] ring-1 ring-[#7a4a31]/25" : "border-[#e7d7c1] bg-white/70 text-zinc-700 hover:border-[#7a4a31]/60"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 rounded-full border border-black/15 shadow-inner"
                  style={{ background: color.swatch }}
                />
                {color.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#5f3826]">Tamaño</legend>
        <div className="grid grid-cols-3 gap-2">
          {variant.availableSizes.map((size) => {
            const selected = size === selectedSize;
            return (
              <button
                key={size}
                type="button"
                onClick={() => onSizeChange(size)}
                aria-pressed={selected}
                className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a4a31] ${
                  selected ? "border-[#7a4a31] bg-[#7a4a31] text-white" : "border-[#e7d7c1] bg-white text-[#5f3826] hover:border-[#7a4a31]/60"
                }`}
              >
                {mateSizeLabels[size]}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-[#5f3826]/70">
          Los precios específicos por tamaño se aplicarán automáticamente cuando estén disponibles en catálogo.
        </p>
      </fieldset>
    </div>
  );
}

