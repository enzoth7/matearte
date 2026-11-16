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
    <div className="space-y-4 rounded-2xl border border-brand-line bg-brand-white/70 p-3">
      <fieldset>
        <legend className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-brown">Color del cuero</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {variant.colors.map((color) => {
            const selected = color.id === selectedColorId;
            return (
              <button
                key={color.id}
                type="button"
                onClick={() => onColorChange(color.id)}
                aria-pressed={selected}
                className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-brown ${
                  selected ? "border-brand-brown bg-brand-white text-brand-brown ring-1 ring-brand-brown/25" : "border-brand-line bg-brand-white/70 text-brand-black hover:border-brand-brown/60"
                }`}
              >
                <strong data-inline
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 rounded-full border border-brand-black/15 shadow-inner"
                  style={{ background: color.swatch }}
                />
                {color.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-brown">Tamaño</legend>
        <div className="grid grid-cols-3 gap-2">
          {variant.availableSizes.map((size) => {
            const selected = size === selectedSize;
            return (
              <button
                key={size}
                type="button"
                onClick={() => onSizeChange(size)}
                aria-pressed={selected}
                className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-brown ${
                  selected ? "border-brand-brown bg-brand-brown text-brand-white" : "border-brand-line bg-brand-white text-brand-brown hover:border-brand-brown/60"
                }`}
              >
                {mateSizeLabels[size]}
              </button>
            );
          })}
        </div>
        <div data-copy className="mt-2 text-[10px] leading-relaxed text-brand-brown/70">
          Los precios específicos por tamaño se aplicarán automáticamente cuando estén disponibles en catálogo.
        </div>
      </fieldset>
    </div>
  );
}

