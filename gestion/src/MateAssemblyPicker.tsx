import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { assemblyFieldsFor, coreAssemblyFieldsFor, priceMateAssembly, validateMateAssembly, validateMateAssemblyCore, type MateAssembly } from "../../shared/mate-assembly";
import { money } from "./data";
import type { PublishedLocalPricing } from "./localPersonalizationPricing";

export function MateAssemblyFields({ value, onChange, coreOnly = false }: { value: MateAssembly; onChange: (value: MateAssembly) => void; coreOnly?: boolean }) {
  const fields = coreOnly ? coreAssemblyFieldsFor(value) : assemblyFieldsFor(value);
  return <div className="local-sale-custom-picker">{fields.map(field => <label key={field.code}><div className="local-sale-custom-field-label">{field.label}{(field.code === "tipo-mate" || field.code === "forma-criollo" || field.code === "tipo-cuero") && <b className="field-required" aria-hidden="true">*</b>}</div><select aria-label={field.label} value={value[field.code] || ""} onChange={event => {
    const { ["diseno-fleje"]: _legacyDesign, ...materials } = value;
    const next = { ...materials, [field.code]: event.target.value };
    if (field.code === "tipo-mate") {
      if (event.target.value !== "criollo") delete next["forma-criollo"];
    }
    onChange(next);
  }}><option value="">Elegir</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div>;
}
export function MateAssemblyPrice({ value, pricing }: { value: MateAssembly; pricing: PublishedLocalPricing | null }) {
  const quote = priceMateAssembly(value, pricing?.rules);
  const missingField = validateMateAssembly(value);
  const hasPrice = Boolean(pricing) && !validateMateAssemblyCore(value) && !quote.missing.length;
  return <div className="local-personalization-price" aria-label="Precio del armado">{quote.items.map(item => <div key={item.ruleKey}><div className="local-personalization-price-label">{item.label}</div><strong>{money(item.totalMinor / 100)}</strong></div>)}<div><div className="local-personalization-price-label">{missingField ? "Precio del mate con lo elegido, sin grabado" : "Mate armado, sin grabado"}</div><strong>{hasPrice ? money(quote.totalMinor / 100) : "Tarifa no disponible"}</strong></div>{missingField && <small className="local-personalization-price-note">El precio se actualiza si elegís más materiales. Completá {missingField.toLocaleLowerCase("es")} y el resto antes de guardar.</small>}{Boolean(quote.missing.length) && <small>Faltan tarifas publicadas en Productos → Personalizador.</small>}</div>;
}
export function MateAssemblyPicker({ pricing, onAdd }: { pricing: PublishedLocalPricing | null; onAdd: (assembly: MateAssembly) => void }) {
  const [value, setValue] = useState<MateAssembly>({});
  const quote = priceMateAssembly(value, pricing?.rules);
  return <div className="local-custom-builder"><MateAssemblyFields value={value} onChange={setValue} coreOnly />{!validateMateAssemblyCore(value) && <div className="local-personalization-price" aria-label="Precio rápido del mate"><div><div className="local-personalization-price-label">Precio del mate con lo elegido</div><strong>{pricing && !quote.missing.length ? money(quote.totalMinor / 100) : "Tarifa no disponible"}</strong></div><small className="local-personalization-price-note">Se actualiza al elegir materiales y diseño.</small></div>}<div>Después de agregarlo, cargá letras e íconos; completá los demás materiales antes de guardar la venta.</div><button type="button" className="secondary" disabled={Boolean(validateMateAssemblyCore(value))} onClick={() => { onAdd({ ...value }); setValue({}); }}><Plus size={17} />Agregar personalizado</button></div>;
}
