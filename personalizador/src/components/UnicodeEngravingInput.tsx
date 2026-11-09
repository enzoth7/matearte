import { useId, useRef, useState } from "react";
import { limitEngravingCharacters } from "../utils/engravingText";

export { limitEngravingCharacters } from "../utils/engravingText";

const characters = ["Ø", "ø", "Æ", "æ", "Å", "å", "Ñ", "ñ", "Ç", "ç", "Ü", "ü", "ß", "Ж", "Я", "あ", "中"];

interface UnicodeEngravingInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
}

export function UnicodeEngravingInput({ label, value, onChange, maxLength, disabled, placeholder, className = "", onFocus }: UnicodeEngravingInputProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const [compositionValue, setCompositionValue] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const insert = (character: string) => {
    const field = input.current;
    const position = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? position;
    const next = limitEngravingCharacters(value.slice(0, position) + character + value.slice(end), maxLength);
    onChange(next);
    field?.focus();
    requestAnimationFrame(() => field?.setSelectionRange(position + character.length, position + character.length));
  };

  return <div className={`unicode-engraving-field ${className}`}>
    <label htmlFor={id}>{label}</label>
    <div className="unicode-engraving-control">
      <input
        ref={input}
        id={id}
        type="text"
        value={compositionValue ?? value}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={onFocus}
        onCompositionStart={() => { composing.current = true; setCompositionValue(value); }}
        onCompositionEnd={(event) => {
          composing.current = false;
          setCompositionValue(null);
          onChange(limitEngravingCharacters(event.currentTarget.value, maxLength));
        }}
        onChange={(event) => {
          if (composing.current || (event.nativeEvent as InputEvent).isComposing) setCompositionValue(event.target.value);
          else onChange(limitEngravingCharacters(event.target.value, maxLength));
        }}
      />
      <button type="button" disabled={disabled} aria-label={`Insertar caracteres en ${label}`} aria-expanded={pickerOpen} onClick={() => setPickerOpen(!pickerOpen)}>Ø</button>
    </div>
    {pickerOpen && !disabled && <div className="unicode-engraving-characters" aria-label={`Caracteres para ${label}`}>
      {characters.map((character) => <button type="button" key={character} aria-label={`Insertar ${character}`} onMouseDown={(event) => event.preventDefault()} onClick={() => insert(character)}>{character}</button>)}
      <small>También podés escribir o pegar texto en cualquier idioma.</small>
    </div>}
  </div>;
}
