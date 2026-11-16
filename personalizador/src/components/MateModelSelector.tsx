import { mateModels, type MateModel } from "../catalog/mateCatalog";

interface MateModelSelectorProps {
  selectedModel: MateModel;
  onSelect: (model: MateModel) => void;
}

export function MateModelSelector({ selectedModel, onSelect }: MateModelSelectorProps) {
  return (
    <div>
      <strong data-inline className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-brand-black/70">Tipo de mate</strong>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {mateModels.map((model) => {
          const isSelected = model.id === selectedModel;
          return (
            <button key={model.id} type="button" onClick={() => onSelect(model.id)} aria-pressed={isSelected} className={`min-h-11 rounded-xl border px-3 py-3 text-center text-[10px] font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-brown ${isSelected ? "border-brand-brown bg-brand-brown/5 text-brand-brown ring-1 ring-brand-brown/25" : "border-brand-black/18 bg-brand-white text-brand-black hover:border-brand-brown"}`}>
              {model.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
