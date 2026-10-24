import { assemblyLabels, assemblyName, assemblySummary, priceMateAssembly, type MateAssembly } from "../../shared/mate-assembly";
import type { Product } from "./data";

/** Presentation adapter for the existing design editor; never a catalog row or SKU. */
export function mateAssemblyPresentation(assembly: MateAssembly, rules?: Record<string, number>): Product {
  const labels = assemblyLabels(assembly);
  const price = priceMateAssembly(assembly, rules).totalMinor / 100;
  return { id: "", sku: "", name: assemblyName(assembly), variant: assemblySummary(assembly), family: "Personalizados", categoryCode: "mates", personalizationType: "mate", assembly,
    attributes: assembly, options: { color: assembly.color }, rim: labels["tipo-virola"], leather: labels["tipo-cuero"], cost: 0, stock: 0, min: 0, published: false, prices: { Local: price, Web: price, Mayorista: 0 } };
}
