import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { assemblyFieldsFor, priceMateAssembly, type MateAssembly } from "../../shared/mate-assembly";
import { money } from "./data";
import type { PublishedLocalPricing } from "./localPersonalizationPricing";

export function MateAssemblyFields({ value, onChange }: { value: MateAssembly; onChange: (value: MateAssembly) => void }) {
  return <div className="local-sale-custom-picker">{assemblyFieldsFor(value).map(field => <label key={field.code}>{field.label}<select aria-label={field.label} value={value[field.code] || ""} onChange={event => onChange({ ...value, [field.code]: event.target.value })}><option value="">Elegir</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div>;
}
export function MateAssemblyPrice({ value, pricing }: { value: MateAssembly; pricing: PublishedLocalPricing | null }) {
  const quote = priceMateAssembly(value, pricing?.rules);
  return <div className="local-personalization-price" aria-label="Precio del armado">{quote.items.map(item => <div key={item.ruleKey}><span>{item.label}</span><strong>{money(item.totalMinor / 100)}</strong></div>)}<div><span>Mate armado · sin grabado</span><strong>{quote.ready ? money(quote.totalMinor / 100) : "Precio pendiente"}</strong></div>{Boolean(quote.missing.length) && <small>Faltan tarifas publicadas en Productos → Personalizador.</small>}</div>;
}
export function MateAssemblyPicker({ pricing, onAdd }: { pricing: PublishedLocalPricing | null; onAdd: (assembly: MateAssembly) => void }) {
  const [value, setValue] = useState<MateAssembly>({});
  const quote = priceMateAssembly(value, pricing?.rules);
  return <div className="local-custom-builder"><MateAssemblyFields value={value} onChange={setValue} />{value["tipo-mate"] && <MateAssemblyPrice value={value} pricing={pricing} />}<button type="button" className="secondary" disabled={!quote.ready} onClick={() => onAdd({ ...value })}><Plus size={17} />Agregar personalizado{quote.ready ? ` · ${money(quote.totalMinor / 100)}` : ""}</button></div>;
}
