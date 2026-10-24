import type { MateVariant, TorpedoLeatherType, TorpedoRimType } from "../catalog/mateCatalog";
import { MateVariantSelector } from "./MateVariantSelector";

const leatherLabels: Record<TorpedoLeatherType, string> = {
  "cuero-liso": "Cuero liso",
  "cuero-estampado": "Cuero estampado",
  "cuero-crudo": "Cuero crudo",
  "croco-pelos": "Croco / pelos",
};

const rimLabels: Record<TorpedoRimType, string> = {
  "alpaca-grande": "Alpaca grande",
  "alpaca-comun": "Alpaca común",
  "alpaca-bronce": "Alpaca y bronce",
  otros: "Otros metales",
};

interface TorpedoVariantSelectorProps {
  variants: MateVariant[];
  selectedVariantId: string;
  onSelect: (variantId: string) => void;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function TorpedoVariantSelector({ variants, selectedVariantId, onSelect }: TorpedoVariantSelectorProps) {
  const selected = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  if (!selected) return null;

  const selectedLeather = selected.leatherType as TorpedoLeatherType;
  const selectedRim = selected.rimType;
  const leatherOptions = unique(variants.map((variant) => variant.leatherType as TorpedoLeatherType));
  const leatherVariants = variants.filter((variant) => variant.leatherType === selectedLeather);
  const rimOptions = unique(leatherVariants.map((variant) => variant.rimType));
  const compatibleVariants = leatherVariants.filter((variant) => variant.rimType === selectedRim);

  const selectLeather = (leather: TorpedoLeatherType) => {
    const candidates = variants.filter((variant) => variant.leatherType === leather);
    const compatible = candidates.find((variant) => variant.rimType === selectedRim) ?? candidates[0];
    if (compatible) onSelect(compatible.id);
  };

  const selectRim = (rim: TorpedoRimType) => {
    const compatible = leatherVariants.find((variant) => variant.rimType === rim);
    if (compatible) onSelect(compatible.id);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[#e7d7c1] bg-[#fbf3de]/55 p-3">
      <div>
        <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#5f3826]">1. Elegí el cuero</span>
        <div className="grid grid-cols-2 gap-2">
          {leatherOptions.map((leather) => (
            <button
              key={leather}
              type="button"
              onClick={() => selectLeather(leather)}
              aria-pressed={selectedLeather === leather}
              className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                selectedLeather === leather ? "border-[#7a4a31] bg-[#7a4a31] text-white" : "border-[#e7d7c1] bg-white text-[#5f3826] hover:border-[#7a4a31]/60"
              }`}
            >
              {leatherLabels[leather]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#5f3826]">2. Elegí la virola compatible</span>
        <div className="grid grid-cols-2 gap-2">
          {rimOptions.map((rim) => (
            <button
              key={rim}
              type="button"
              onClick={() => selectRim(rim)}
              aria-pressed={selectedRim === rim}
              className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                selectedRim === rim ? "border-[#7a4a31] bg-white text-[#7a4a31] ring-1 ring-[#7a4a31]/25" : "border-[#e7d7c1] bg-white/70 text-zinc-700 hover:border-[#7a4a31]/60"
              }`}
            >
              {rimLabels[rim]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#5f3826]">3. Producto existente</span>
        <MateVariantSelector variants={compatibleVariants} selectedVariantId={selectedVariantId} onSelect={onSelect} />
      </div>
    </div>
  );
}

