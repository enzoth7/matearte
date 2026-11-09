export type CostCurrency = "UYU" | "ARS" | "USD";
export type CostKind = "material" | "supply" | "option" | "labor" | "packaging" | "waste" | "purchase" | "freight";
export type CostMode = "per_product" | "purchase_quantity";

export type CostProfile = {
  id: string; category_code: string; name: string;
  method: "fabricacion" | "reventa"; benchmark_material_minor: number | null;
};
export type CostLine = {
  id: string; profile_id: string; name: string; group_name?: string; kind: CostKind; mode: CostMode;
  catalog_variant_id?: string | null;
  amount_minor: number | null; currency: CostCurrency; exchange_rate_to_uyu: number | null;
  purchase_quantity: number | null; consumption_quantity: number | null; unit: string | null;
  sort_order: number;
};

export function lineCostUyuMinor(line: CostLine): number | null {
  if (line.amount_minor === null || !Number.isFinite(line.amount_minor) || line.amount_minor < 0) return null;
  const rate = line.currency === "UYU" ? 1 : line.exchange_rate_to_uyu;
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;
  const quantity = line.mode === "purchase_quantity"
    ? line.purchase_quantity && line.consumption_quantity && line.purchase_quantity > 0 && line.consumption_quantity > 0
      ? line.consumption_quantity / line.purchase_quantity : null
    : 1;
  return quantity === null ? null : Math.round(line.amount_minor * rate * quantity);
}

export function costSummary(profile: CostProfile, lines: CostLine[]) {
  const belonging = lines.filter((line) => line.profile_id === profile.id);
  const sum = (kinds: CostKind[]) => {
    const selected = belonging.filter((line) => kinds.includes(line.kind));
    const amounts = selected.map(lineCostUyuMinor);
    return selected.length && amounts.every((amount) => amount !== null)
      ? amounts.reduce<number>((total, amount) => total + (amount || 0), 0) : null;
  };
  const materials = sum(["material"]);
  const labor = sum(["labor"]);
  const packaging = sum(["packaging"]);
  const waste = sum(["waste"]);
  const purchase = sum(["purchase"]);
  const freight = sum(["freight"]);
  const total = profile.method === "fabricacion"
    ? materials !== null && labor !== null && packaging !== null && waste !== null
      ? materials + labor + packaging + waste : null
    : purchase !== null && freight !== null ? purchase + freight : null;
  return { materials, labor, packaging, waste, purchase, freight, total,
    difference: materials === null || profile.benchmark_material_minor === null
      ? null : materials - profile.benchmark_material_minor };
}

export function materialsWithOptionsUyuMinor(baseMaterialsMinor: number | null, options: CostLine[]): number | null {
  if (baseMaterialsMinor === null) return null;
  const amounts = options.map(lineCostUyuMinor);
  if (amounts.some((amount) => amount === null)) return null;
  return baseMaterialsMinor + amounts.reduce<number>((sum, amount) => sum + (amount || 0), 0);
}
