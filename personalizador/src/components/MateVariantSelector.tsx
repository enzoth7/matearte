import type { MateVariant } from "../catalog/mateCatalog";
import { getVariantDetails } from "../catalog/pricingCatalog";

interface MateVariantSelectorProps {
  variants: MateVariant[];
  selectedVariantId: string;
  onSelect: (variantId: string) => void;
}

export function MateVariantSelector({ variants, selectedVariantId, onSelect }: MateVariantSelectorProps) {
  return (
    <div>
      <strong data-inline className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-brand-black/70">Variante base</strong>
      <div className="grid max-h-[370px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {variants.map((variant) => {
          const isSelected = variant.id === selectedVariantId;
          const details = getVariantDetails(variant.id);
          const displayName = details?.name || variant.name;
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id)}
              aria-pressed={isSelected}
              className={`rounded-xl border p-2 text-center transition-all cursor-pointer ${
                isSelected
                  ? "border-brand-brown bg-brand-brown/5 ring-1 ring-brand-brown/25"
                  : "border-brand-black/18 bg-brand-white hover:border-brand-brown"
              }`}
            >
              <img src={variant.image} alt={displayName} className="mate-product-photo mx-auto aspect-square w-full rounded-lg" loading="lazy" draggable={false} />
              <strong data-inline className={`mt-1 block text-[10px] font-bold leading-tight ${isSelected ? "text-brand-brown" : "text-brand-black"}`}>
                {displayName}
              </strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}
