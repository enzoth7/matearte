import { useState } from "react";
import { MAX_RIM_TEXT_LENGTH, sanitizeRimText } from "../catalog/rimCatalog";

interface RimTextEditorProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  label?: string;
  maxWords?: number;
  maxLength?: number;
}

export function RimTextEditor({
  value,
  disabled,
  onChange,
  label = "Texto de virola",
  maxWords,
  maxLength,
}: RimTextEditorProps) {
  const [limitReached, setLimitReached] = useState(false);
  const effectiveMaxLength = maxLength ?? (maxWords ? 25 : MAX_RIM_TEXT_LENGTH);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    const sanitized = sanitizeRimText(rawValue);

    // 1. Strict Total Character Limit
    if (sanitized.length > effectiveMaxLength) {
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

  return (
    <label className="block">
      <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={handleChange}
        placeholder={disabled ? "Seleccioná Con texto para escribir" : "Escribí tu texto"}
        aria-describedby="rim-text-status"
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs font-medium text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#7a4a31] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
      />
      <span id="rim-text-status" className={`mt-1 flex justify-between text-[9px] font-medium ${limitReached ? "text-red-600 font-bold" : "text-zinc-400"}`}>
        <span>
          {limitReached 
            ? `¡Límite alcanzado! Máximo ${effectiveMaxLength} caracteres.`
            : "Normalización automática de espacios"}
        </span>
        <span>
          {value.length} / {effectiveMaxLength} caracteres
        </span>
      </span>
    </label>
  );
}
