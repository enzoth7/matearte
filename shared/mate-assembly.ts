import { defaultCatalogTaxonomy, taxonomyOptionsFor } from "./catalog-taxonomy";

export type MateAssembly = Record<string, string>;
export type AssemblyOption = { value: string; label: string; ruleKey: string; initialPrice: number };
export type AssemblyField = { code: string; label: string; options: AssemblyOption[] };
const existing: Record<string, [string, number]> = {
  "tipo-cuero:crudo": ["leather:raw", 600], "tipo-cuero:estampado": ["leather:stamped", 200],
  "tipo-cuero:pelos": ["leather:print-pelos", 600], "tipo-cuero:vaqueta": ["leather:vaqueta", 400],
  "tipo-virola:alpaca-y-bronce": ["metal:alpaca-bronce", 300],
  "tipo-virola:alpaca-grande-lisa": ["metal:alpaca-grande", 300],
  "tipo-virola:alpaca-grande-cincelada": ["metal:alpaca-grande", 300],
  "tipo-virola:plata": ["metal:plata-900", 17500],
  "tipo-virola:imperial-premium": ["tree:imperial:cincelado-premium", 3000],
  "tipo-virola:alpaca-grande-lacre": ["metal:criollo:torpedo-criollo-posa-mate:alpaca-grande-lacre", 2500],
};
const initial: Record<string, number> = { "tipo-cuero:croco": 600, "pie:alpaca": 700, "posamate:con-posamate": 300, "tipo-virola:acero-cincelado": 100, "tipo-virola:acero-y-bronce-liso": 200, "tipo-virola:alpaca-grande-cincelada-premium": 2300 };
const extras: Record<string, Array<[string, string]>> = {
  "tipo-cuero": [["vaqueta", "Vaqueta"]], color: [["animal-print", "Animal print"]],
  interior: [["madera", "Madera"], ["acero-inoxidable", "Acero inoxidable"]],
  "tipo-virola": [["alpaca-grande-lacre", "Alpaca grande al lacre"]],
  "diseno-fleje": [["sin-fleje", "Sin fleje"]],
  "forma-criollo": [["imperial", "Imperial"], ["torpedo", "Torpedo"], ["camionero", "Camionero"]],
};
const bases: Record<string, number> = { imperial: 2600, torpedo: 1800, camionero: 1800, criollo: 0 };
export const mateAssemblyFields: AssemblyField[] = [
  ["tipo-mate", "Modelo"], ["forma-criollo", "Forma del criollo"], ["interior", "Interior"], ["tipo-cuero", "Cuero o textura"],
  ["color", "Color"], ["tipo-virola", "Virola"], ["diseno-fleje", "Diseño del fleje"], ["posamate", "Posamate"], ["pie", "Pie"], ["tamano", "Tamaño"],
].map(([code, label]) => ({ code, label, options: [
  ...taxonomyOptionsFor(defaultCatalogTaxonomy, code).filter(o => o.code !== "todos").map(o => [o.code, o.label_es]), ...(extras[code] || []),
].map(([value, optionLabel]) => {
  const [ruleKey, initialPrice] = code === "tipo-mate" ? [`family:${value}`, bases[value]]
    : code === "forma-criollo" ? [`tree:criollo:${value}-criollo-posa-mate`, value === "imperial" ? 2100 : 1300]
    : existing[`${code}:${value}`] || [`assembly:${code}:${value}`, initial[`${code}:${value}`] || 0];
  return { value, label: code === "posamate" ? value === "con-posamate" ? "Con" : "Sin" : optionLabel, ruleKey: String(ruleKey), initialPrice: Number(initialPrice) };
}) }));

export const assemblyHasFleje = (assembly: MateAssembly) => ["imperial", "criollo"].includes(assembly["tipo-mate"]) && assembly["diseno-fleje"] !== "sin-fleje";
export const assemblyFieldsFor = (assembly: MateAssembly) => mateAssemblyFields.filter(field => (field.code !== "forma-criollo" || assembly["tipo-mate"] === "criollo") && (field.code !== "diseno-fleje" || ["imperial", "criollo"].includes(assembly["tipo-mate"])));
export const assemblyLabels = (assembly: MateAssembly) => Object.fromEntries(assemblyFieldsFor(assembly).map(field => [field.code, field.options.find(o => o.value === assembly[field.code])?.label || "Pendiente"]));
export const assemblyName = (assembly: MateAssembly) => `Mate ${assemblyLabels(assembly)["tipo-mate"]} personalizado`;
export const assemblySummary = (assembly: MateAssembly) => assemblyFieldsFor(assembly).filter(f => f.code !== "tipo-mate").map(f => `${f.label}: ${assemblyLabels(assembly)[f.code]}`).join(" · ");
export const validateMateAssembly = (assembly: MateAssembly) => assemblyFieldsFor(assembly).find(field => !field.options.some(o => o.value === assembly[field.code]))?.label;

export function mateAssemblyRuleKeys(assembly: MateAssembly) {
  const keys = assemblyFieldsFor(assembly).flatMap(field => {
    const option = field.options.find(o => o.value === assembly[field.code]);
    if (!option) return [];
    if (field.code === "color") return [];
    if (field.code === "tipo-cuero" && option.value === "crudo" && assembly.posamate === "con-posamate") return ["leather:raw-posa-mate"];
    if (field.code === "posamate" && option.value === "con-posamate" && (assembly["tipo-cuero"] === "crudo" || assembly["tipo-mate"] === "criollo")) return [];
    if (field.code === "tipo-virola" && option.value === "alpaca-grande-lacre") return [`metal:criollo:${assembly["tipo-mate"] === "criollo" ? assembly["forma-criollo"] === "imperial" ? "imperial" : "torpedo" : assembly["tipo-mate"] === "imperial" ? "imperial" : "torpedo"}-criollo-posa-mate:alpaca-grande-lacre`];
    return [option.ruleKey];
  });
  return [...new Set(keys)];
}
export function priceMateAssembly(assembly: MateAssembly, rules: Record<string, number> | undefined) {
  const missing = mateAssemblyRuleKeys(assembly).filter(key => typeof rules?.[key] !== "number" || !Number.isFinite(rules[key]) || rules[key] < 0);
  const items = mateAssemblyRuleKeys(assembly).filter(key => !missing.includes(key)).map(ruleKey => ({ ruleKey, label: mateAssemblyFields.flatMap(f => f.options.map(o => ({ ...o, label: `${f.label}: ${o.label}` }))).find(o => o.ruleKey === ruleKey)?.label || (ruleKey === "leather:raw-posa-mate" ? "Cuero crudo con posamate" : "Alpaca grande al lacre"), totalMinor: Math.round(rules![ruleKey] * 100) }));
  return { items, missing, totalMinor: items.reduce((sum, item) => sum + item.totalMinor, 0), ready: !validateMateAssembly(assembly) && !missing.length && Boolean(rules) };
}
