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
    <div className="space-y-4 rounded-2xl border border-brand-line bg-brand-white/55 p-3">
      <div>
        <strong data-inline className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-brand-brown">Elegí el cuero</strong>
        <div className="grid grid-cols-2 gap-2">
          {leatherOptions.map((leather) => (
            <button
              key={leather}
              type="button"
              onClick={() => selectLeather(leather)}
              aria-pressed={selectedLeather === leather}
              className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                selectedLeather === leather ? "border-brand-brown bg-brand-brown text-brand-white" : "border-brand-line bg-brand-white text-brand-brown hover:border-brand-brown/60"
              }`}
            >
              {leatherLabels[leather]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <strong data-inline className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-brand-brown">Elegí la virola compatible</strong>
        <div className="grid grid-cols-2 gap-2">
          {rimOptions.map((rim) => (
            <button
              key={rim}
              type="button"
              onClick={() => selectRim(rim)}
              aria-pressed={selectedRim === rim}
              className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                selectedRim === rim ? "border-brand-brown bg-brand-white text-brand-brown ring-1 ring-brand-brown/25" : "border-brand-line bg-brand-white/70 text-brand-black hover:border-brand-brown/60"
              }`}
            >
              {rimLabels[rim]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <strong data-inline className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-brand-brown">Producto existente</strong>
        <MateVariantSelector variants={compatibleVariants} selectedVariantId={selectedVariantId} onSelect={onSelect} />
      </div>
    </div>
  );
}

