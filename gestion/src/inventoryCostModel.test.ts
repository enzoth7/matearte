import { describe, expect, it } from "vitest";
import { costSummary, lineCostUyuMinor, materialsWithOptionsUyuMinor, type CostLine, type CostProfile } from "./inventoryCostModel";

const mate: CostProfile = { id: "mate", category_code: "mates", name: "Mate imperial alpaca", method: "fabricacion", benchmark_material_minor: 60500 };
const base = (id: string, kind: CostLine["kind"], amount_minor: number | null): CostLine => ({
  id, profile_id: "mate", name: id, kind, mode: "per_product", amount_minor, currency: "UYU",
  exchange_rate_to_uyu: null, purchase_quantity: null, consumption_quantity: null, unit: null, sort_order: 0,
});

describe("costeo de insumos", () => {
  it("conserva los UYU 605 en materiales y no cuenta el cincelado en la base", () => {
    const lines = [base("mate", "material", 8000), base("cuero", "material", 18000),
      base("fleje", "material", 25000), base("virola", "material", 6500),
      base("consumibles", "material", 3000), base("cincelado", "option", 2000),
      base("trabajo", "labor", null), base("packaging", "packaging", null), base("merma", "waste", null)];
    expect(costSummary(mate, lines)).toMatchObject({ materials: 60500, difference: 0, total: null });
    expect(materialsWithOptionsUyuMinor(60500, [])).toBe(60500);
    expect(materialsWithOptionsUyuMinor(60500, [lines[5]])).toBe(62500);
    lines[5].amount_minor = null;
    expect(materialsWithOptionsUyuMinor(60500, [lines[5]])).toBeNull();
    lines[1].amount_minor = 19000;
    expect(costSummary(mate, lines).difference).toBe(1000);
  });
  it("convierte compras con cotización guardada y cantidad consumida", () => {
    const line = { ...base("cuero", "material", 10000), currency: "ARS" as const,
      exchange_rate_to_uyu: 0.03, mode: "purchase_quantity" as const,
      purchase_quantity: 10, consumption_quantity: 2, unit: "metros" };
    expect(lineCostUyuMinor(line)).toBe(60);
  });
  it("mantiene el costo de reventa sin cargar como pendiente", () => {
    const boots: CostProfile = { id: "botas", category_code: "botas", name: "Botas", method: "reventa", benchmark_material_minor: null };
    const purchase = { ...base("compra", "purchase", null), profile_id: "botas" };
    const freight = { ...base("flete", "freight", null), profile_id: "botas" };
    expect(costSummary(boots, [purchase, freight]).total).toBeNull();
  });
});
