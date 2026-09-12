"use client";

import { useLocale } from "next-intl";
import type { Product } from "@/types/catalog";
import { getVariantColorHex } from "@/lib/catalog-filters";

const labels: Record<string, Record<string, string>> = {
  es: { color: "Color", talle: "Talle", tamano: "Tamaño", "capacidad-ml": "Capacidad" },
  en: { color: "Color", talle: "Size", tamano: "Size", "capacidad-ml": "Capacity" },
  pt: { color: "Cor", talle: "Tamanho", tamano: "Tamanho", "capacidad-ml": "Capacidade" },
};

const optionLabels: Record<string, Record<string, Record<string, string>>> = {
  tamano: {
    es: { chico: "Chico", mediano: "Mediano", grande: "Grande", pequeno: "Chico" },
    en: { chico: "Small", mediano: "Medium", grande: "Large", pequeno: "Small" },
    pt: { chico: "Pequeno", mediano: "Médio", grande: "Grande", pequeno: "Pequeno" },
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
  return `${value}${axisCode === "capacidad-ml" ? " ml" : ""}`;
}

export function StructuredVariantPicker({product,axes,selected,onSelect}:{product:Product;axes:Array<{code:string;values:string[]}>;selected:Record<string,string|number|boolean>;onSelect:(code:string,value:string)=>void}) {
  const locale = useLocale();
  if (!axes.length) return null;
  return <div className="structured-variant-picker">{axes.map(axis=><fieldset key={axis.code}><legend>{labels[locale]?.[axis.code] ?? labels.es[axis.code] ?? axis.code.replaceAll("-"," ")}</legend><div>{axis.values.map(value=>{
    const representative=product.variants.find(variant=>String(variant.options?.[axis.code] ?? (axis.code==='color'?variant.color:''))===value);
    const active=String(selected[axis.code]??'')===value;
    return axis.code==='color' ? <button key={value} type="button" className="structured-color" onClick={()=>onSelect(axis.code,value)} style={{backgroundColor:getVariantColorHex(representative??value)}} title={representative?.label??value} aria-label={representative?.label??value} aria-pressed={active} data-selected={active}/>
      : <button key={value} type="button" className="structured-option" onClick={()=>onSelect(axis.code,value)} aria-pressed={active} data-selected={active}>{formatOptionLabel(axis.code, value, locale)}</button>;
  })}</div></fieldset>)}</div>;
}
