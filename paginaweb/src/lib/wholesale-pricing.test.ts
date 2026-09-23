import { describe, expect, it } from "vitest";
import { applyWholesaleMateDiscount, DEFAULT_WHOLESALE_DISCOUNT_SETTINGS } from "./wholesale-pricing";

const line = (quantity: number, category = "mates", unitPriceMinor = 113_640, baseUnitPriceMinor = 100_000) => ({
  itemType: "catalog" as const,
  quantity,
  category,
  unitPriceMinor,
  baseUnitPriceMinor,
});

describe("applyWholesaleMateDiscount", () => {
  it("desde exactamente 30 mates quita el ajuste y aplica 30% sobre el precio base", () => {
    expect(applyWholesaleMateDiscount([line(30)], DEFAULT_WHOLESALE_DISCOUNT_SETTINGS)[0].unitPriceMinor).toBe(70_000);
  });

  it("no activa el modo mayorista con 29 mates", () => {
    expect(applyWholesaleMateDiscount([line(29)], DEFAULT_WHOLESALE_DISCOUNT_SETTINGS)[0].unitPriceMinor).toBe(113_640);
  });

  it("aplica 30% al alcanzar 30 mates sumando distintas líneas", () => {
    const result = applyWholesaleMateDiscount([line(19), line(11, "mates", 227_280, 200_000)], DEFAULT_WHOLESALE_DISCOUNT_SETTINGS);
    expect(result.map((item) => item.unitPriceMinor)).toEqual([70_000, 140_000]);
  });

  it("no descuenta otros productos ni diseños", () => {
    const result = applyWholesaleMateDiscount([
      line(31),
      line(2, "bombillas", 113_640, 100_000),
      { itemType: "design" as const, quantity: 1, unitPriceMinor: 300_000 },
    ], DEFAULT_WHOLESALE_DISCOUNT_SETTINGS);
    expect(result.map((item) => item.unitPriceMinor)).toEqual([70_000, 113_640, 300_000]);
  });

  it("respeta el interruptor y los valores editables", () => {
    const disabled = { ...DEFAULT_WHOLESALE_DISCOUNT_SETTINGS, wholesale_mate_discount_enabled: false };
    expect(applyWholesaleMateDiscount([line(31)], disabled)[0].unitPriceMinor).toBe(113_640);
    const custom = { ...DEFAULT_WHOLESALE_DISCOUNT_SETTINGS, wholesale_mate_quantity_threshold: 10, wholesale_mate_discount_percent: 12.5 };
    expect(applyWholesaleMateDiscount([line(10)], custom)[0].unitPriceMinor).toBe(87_500);
  });
});
