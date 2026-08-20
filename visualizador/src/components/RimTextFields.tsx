import { MAX_RIM_TEXT_LENGTH, sanitizeRimText } from "../catalog/rimCatalog";
import { createDefaultElementTransform, type RimTextElement } from "../types/customizer";

interface RimTextFieldsProps {
  texts: RimTextElement[];
  selectedElement: string | null;
  onSelectElement: (id: string) => void;
  onChange: (texts: RimTextElement[]) => void;
}

const defaultTexts: RimTextElement[] = [
  { id: "text-1", text: "", inverted: false, transform: createDefaultElementTransform("rim") },
  { id: "text-2", text: "", inverted: true, transform: createDefaultElementTransform("rim") },
];

export function RimTextFields({ texts, selectedElement, onSelectElement, onChange }: RimTextFieldsProps) {
  const safeTexts = defaultTexts.map((fallback, index) => texts[index] ?? fallback);
  const activeIndex = selectedElement === "text-2" ? 1 : 0;
  const activeScale = safeTexts[activeIndex].transform.scale;

  const updateText = (index: number, value: string) => {
    const sanitized = sanitizeRimText(value).slice(0, MAX_RIM_TEXT_LENGTH);
    onChange(safeTexts.map((item, itemIndex) => itemIndex === index ? { ...item, text: sanitized } : item));
  };

  const updateSize = (scale: number) => {
    onChange(safeTexts.map((item, index) => index === activeIndex
      ? { ...item, transform: { ...item.transform, scale } }
      : item));
  };

  return (
    <div className="rim-text-fields">
      {safeTexts.map((item, index) => (
        <label key={item.id} className="rim-text-field">
          <span>Texto {index + 1}</span>
          <input
            type="text"
            value={item.text}
            maxLength={MAX_RIM_TEXT_LENGTH}
            onFocus={() => onSelectElement(item.id)}
            onChange={(event) => updateText(index, event.target.value)}
            aria-label={`Texto ${index + 1} de virola`}
          />
        </label>
      ))}

      <fieldset className="rim-text-size">
        <legend>Tamaño de letra</legend>
        <button type="button" onClick={() => updateSize(0.75)} aria-pressed={activeScale < 0.9}>6mm</button>
        <button type="button" onClick={() => updateSize(1)} aria-pressed={activeScale >= 0.9}>8mm</button>
      </fieldset>
    </div>
  );
}
