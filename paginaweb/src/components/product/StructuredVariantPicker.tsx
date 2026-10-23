"use client";

import { useLocale } from "next-intl";
import type { Product } from "@/types/catalog";
import { getVariantColorBackground } from "@/lib/catalog-filters";
import type { CatalogPurchaseAxis } from "../../../../shared/catalog-taxonomy";

const labels: Record<string, Record<string, string>> = {
  es: { color: "Color", talle: "Número de bota", tamano: "Tamaño", interior: "Interior", "largo-mm": "Largo", "largo-cinto-cm": "Largo del cinto" },
  en: { color: "Color", talle: "Boot size", tamano: "Size", interior: "Interior", "largo-mm": "Length", "largo-cinto-cm": "Belt length" },
  pt: { color: "Cor", talle: "Número da bota", tamano: "Tamanho", interior: "Interior", "largo-mm": "Comprimento", "largo-cinto-cm": "Comprimento do cinto" },
};

const unavailableMeasure: Record<string, string> = {
  es: "Medida pendiente de configurar. Todavía no se puede agregar al carrito.",
  en: "Size pending configuration. This product cannot be added to the cart yet.",
  pt: "Medida pendente de configuração. Este produto ainda não pode ser adicionado ao carrinho.",
};

const optionLabels: Record<string, Record<string, Record<string, string>>> = {
  tamano: {
    es: { todos: "Todos los tamaños", chico: "Chico", mediano: "Mediano", grande: "Grande", pequeno: "Chico" },
    en: { todos: "All sizes", chico: "Small", mediano: "Medium", grande: "Large", pequeno: "Small" },
    pt: { todos: "Todos os tamanhos", chico: "Pequeno", mediano: "Médio", grande: "Grande", pequeno: "Pequeno" },
  },
  interior: {
    es: { calabaza: "Interior Calabaza", ceramica: "Interior Cerámica" },
    en: { calabaza: "Gourd interior", ceramica: "Ceramic interior" },
    pt: { calabaza: "Interior de cabaça", ceramica: "Interior de cerâmica" },
  },
  talle: {
    es: { todos: "Todos los talles" },
    en: { todos: "All sizes" },
    pt: { todos: "Todos os tamanhos" },
  },
};

function formatOptionLabel(axisCode: string, value: string, locale: string): string {
  const normalized = value.toLowerCase();
  const localized = optionLabels[axisCode]?.[locale]?.[normalized] ?? optionLabels[axisCode]?.es?.[normalized];
  if (localized) return localized;
  if (axisCode === "largo-cinto-cm") return `${value} cm`;
  if (axisCode === "largo-mm") {
    const length = value === "larga" ? "19 cm" : value === "corta" ? "16 cm" : "";
    const names = value === "larga" ? { es: "Larga", en: "Long", pt: "Longa" } : { es: "Corta", en: "Short", pt: "Curta" };
    return `${names[locale as "es" | "en" | "pt"] ?? names.es}${length ? ` (${length})` : ""}`;
  }
  return value;
}

export function StructuredVariantPicker({product,axes,selected,onSelect}:{product:Product;axes:CatalogPurchaseAxis[];selected:Record<string,string|number|boolean>;onSelect:(code:string,value:string)=>void}) {
  const locale = useLocale();
  if (!axes.length) return null;
  return <div className="structured-variant-picker">{axes.map(axis=><fieldset key={axis.code}><legend>{labels[locale]?.[axis.code] ?? labels.es[axis.code] ?? axis.label}</legend><div>{!axis.values.length && <p className="structured-option-unavailable">{unavailableMeasure[locale] ?? unavailableMeasure.es}</p>}{axis.values.map(option=>{
    const value=option.value;
    const representative=product.variants.find(variant=>String(variant.options?.color ?? variant.color ?? '')===value);
    const active=String(selected[axis.code]??'')===value;
    return axis.code==='color' ? <button key={value} type="button" className="structured-color" onClick={()=>onSelect(axis.code,value)} style={{background:getVariantColorBackground(representative??value)}} title={representative?.label??value} aria-label={representative?.label??value} aria-pressed={active} data-selected={active}/>
      : <button key={value} type="button" className="structured-option" onClick={()=>onSelect(axis.code,value)} aria-pressed={active} data-selected={active}>{["tamano","interior","talle","largo-mm","largo-cinto-cm"].includes(axis.code) ? formatOptionLabel(axis.code, value, locale) : option.label}</button>;
  })}</div></fieldset>)}</div>;
}
