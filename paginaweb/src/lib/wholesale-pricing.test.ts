import { describe, expect, it } from "vitest";
import { applyWholesaleMateDiscount, DEFAULT_WHOLESALE_DISCOUNT_SETTINGS } from "./wholesale-pricing";

const line = (quantity: number, category = "mates", unitPriceMinor = 100_000) => ({
  itemType: "catalog" as const,
  quantity,
  category,
  unitPriceMinor,
});

describe("applyWholesaleMateDiscount", () => {
  it("aplica el descuento con exactamente 30 mates", () => {
    expect(applyWholesaleMateDiscount([line(30)], DEFAULT_WHOLESALE_DISCOUNT_SETTINGS)[0].unitPriceMinor).toBe(70_000);
  });

  it("aplica 30% al alcanzar 30 mates sumando distintas líneas", () => {
    const result = applyWholesaleMateDiscount([line(19), line(11, "mates", 200_000)], DEFAULT_WHOLESALE_DISCOUNT_SETTINGS);
    expect(result.map((item) => item.unitPriceMinor)).toEqual([70_000, 140_000]);
  });

  it("no descuenta otros productos ni diseños", () => {
    const result = applyWholesaleMateDiscount([
      line(31),
      line(2, "bombillas"),
      { itemType: "design" as const, quantity: 1, unitPriceMinor: 300_000 },
    ], DEFAULT_WHOLESALE_DISCOUNT_SETTINGS);
    expect(result.map((item) => item.unitPriceMinor)).toEqual([70_000, 100_000, 300_000]);
  });

  it("respeta el interruptor y los valores editables", () => {
    const disabled = { ...DEFAULT_WHOLESALE_DISCOUNT_SETTINGS, wholesale_mate_discount_enabled: false };
    expect(applyWholesaleMateDiscount([line(31)], disabled)[0].unitPriceMinor).toBe(100_000);
    const custom = { ...DEFAULT_WHOLESALE_DISCOUNT_SETTINGS, wholesale_mate_quantity_threshold: 10, wholesale_mate_discount_percent: 12.5 };
    expect(applyWholesaleMateDiscount([line(10)], custom)[0].unitPriceMinor).toBe(87_500);
  });
});
