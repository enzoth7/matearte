import { useState } from "react";
import { MAX_RIM_TEXT_LENGTH, sanitizeRimText } from "../catalog/rimCatalog";
import { UnicodeEngravingInput } from "./UnicodeEngravingInput";

interface RimTextEditorProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  label?: string;
  maxWords?: number;
  maxLength?: number;
  compact?: boolean;
}

export function RimTextEditor({
  value,
  disabled,
  onChange,
  label = "Texto de virola",
  maxWords,
  maxLength,
  compact = false,
}: RimTextEditorProps) {
  const [limitReached, setLimitReached] = useState(false);
  const effectiveMaxLength = maxLength ?? (maxWords ? 25 : MAX_RIM_TEXT_LENGTH);

  const handleChange = (rawValue: string) => {
    const sanitized = sanitizeRimText(rawValue);

    // 1. Strict Total Character Limit
    if (Array.from(sanitized).length > effectiveMaxLength) {
      setLimitReached(true);
      return;
    }

    // 2. Strict Word Limit (if specified)
    if (maxWords) {
      const words = sanitized.trimStart().split(/\s+/).filter(Boolean);
      if (words.length > maxWords) {
        setLimitReached(true);
        return;
      }
    }

    setLimitReached(false);
    onChange(sanitized);
  };

  return <div className={compact ? "rim-text-editor--compact" : "rim-text-editor"}>
    <UnicodeEngravingInput label={label} value={value} disabled={disabled} onChange={handleChange}
      maxLength={effectiveMaxLength} placeholder={disabled ? "Seleccioná Con texto para escribir" : "Escribí tu texto"} />
    {!compact && <div className={`mt-1 flex justify-between text-[9px] font-medium ${limitReached ? "text-red-600 font-bold" : "text-zinc-400"}`}>
      <small>{limitReached ? `¡Límite alcanzado! Máximo ${effectiveMaxLength} caracteres.` : "Normalización automática de espacios"}</small>
      <small>{Array.from(value).length} / {effectiveMaxLength} caracteres</small>
    </div>}
  </div>;
}
