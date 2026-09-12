"use client";

import { useLocale } from "next-intl";
import type { Product } from "@/types/catalog";
import { getVariantColorHex } from "@/lib/catalog-filters";

const labels: Record<string,Record<string,string>> = {
  es:{color:"Color",talle:"Talle","capacidad-ml":"Capacidad"},
  en:{color:"Color",talle:"Size","capacidad-ml":"Capacity"},
  pt:{color:"Cor",talle:"Tamanho","capacidad-ml":"Capacidade"},
};

export function StructuredVariantPicker({product,axes,selected,onSelect}:{product:Product;axes:Array<{code:string;values:string[]}>;selected:Record<string,string|number|boolean>;onSelect:(code:string,value:string)=>void}) {
  const locale = useLocale();
  if (!axes.length) return null;
  return <div className="structured-variant-picker">{axes.map(axis=><fieldset key={axis.code}><legend>{labels[locale]?.[axis.code] ?? labels.es[axis.code] ?? axis.code.replaceAll("-"," ")}</legend><div>{axis.values.map(value=>{
    const representative=product.variants.find(variant=>String(variant.options?.[axis.code] ?? (axis.code==='color'?variant.color:''))===value);
    const active=String(selected[axis.code]??'')===value;
    return axis.code==='color' ? <button key={value} type="button" className="structured-color" onClick={()=>onSelect(axis.code,value)} style={{backgroundColor:getVariantColorHex(representative??value)}} title={representative?.label??value} aria-label={representative?.label??value} aria-pressed={active} data-selected={active}/>
      : <button key={value} type="button" className="structured-option" onClick={()=>onSelect(axis.code,value)} aria-pressed={active} data-selected={active}>{value}{axis.code==='capacidad-ml'?' ml':''}</button>;
  })}</div></fieldset>)}</div>;
}
