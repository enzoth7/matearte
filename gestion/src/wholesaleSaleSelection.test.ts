import { describe, expect, it } from "vitest";
import type { WholesaleProduct } from "./wholesaleSource";
import { genericVariantPriceConflict, genericVariantRepresentatives, wholesaleSaleCategory, wholesaleSaleType, wholesaleSaleVariantLabel } from "./wholesaleSaleSelection";

const product = (values: Partial<WholesaleProduct>): WholesaleProduct => ({
  id: "1", model: "", variant: "", rim_type: null, leather_type: null, price_arg: 0, price_uyu: 0, ...values,
});

describe("selección de artículos mayoristas", () => {
  it("agrupa por modelo de mate y conserva el nombre y variante en el último paso", () => {
    const item = product({ model: "Mate Criollo imperial", variant: "Negro", category_code: "mates", catalog_attributes: { "tipo-mate": "criollo" } });
    expect(wholesaleSaleCategory(item)).toBe("mates");
    expect(wholesaleSaleType(item)).toBe("Criollo");
    expect(wholesaleSaleVariantLabel(item)).toBe("Mate Criollo imperial · Negro");
  });

  it("ofrece Genérico solo para nombres con 2 o más variantes y exige un único precio", () => {
    const marron = product({ id: "62", model: "Torpedo A", variant: "Marrón", price_arg: 37000 });
    const negro = product({ id: "63", model: "Torpedo A", variant: "Negro", price_arg: 37000 });
    const unico = product({ id: "70", model: "Torpedo B", variant: "Natural", price_arg: 30000 });
    expect(genericVariantRepresentatives([marron, negro, unico]).map((item) => item.id)).toEqual(["62"]);
    expect(genericVariantPriceConflict([marron, negro])).toBe(false);
    expect(genericVariantPriceConflict([marron, { ...negro, price_arg: 3700 }])).toBe(true);
  });

  it("usa la forma de la matera", () => {
    const item = product({ model: "Matera Ovalada", variant: "Cuero marrón", category_code: "materas", catalog_attributes: { forma: "ovalada" } });
    expect(wholesaleSaleType(item)).toBe("Ovalada");
    expect(wholesaleSaleVariantLabel(item)).toBe("Matera Ovalada · Cuero marrón");
  });

  it("separa bombillas de bombillones aunque ambos tengan la misma categoría interna", () => {
    const bombilla = product({ model: "Bombilla lisa", category_code: "bombillas", catalog_attributes: { "tipo-bombilla": "clasica" } });
    const bombillon = product({ model: "Bombillón de alpaca", category_code: "bombillas", catalog_attributes: { "tipo-bombilla": "bombillon" } });
    expect([wholesaleSaleCategory(bombilla), wholesaleSaleType(bombilla)]).toEqual(["bombillas", "Clásica"]);
    expect([wholesaleSaleCategory(bombillon), wholesaleSaleType(bombillon)]).toEqual(["bombillones", "Bombillón"]);
  });

  it("no muestra el tipo erróneo", () => {
    const item = product({ model: "Bombilla", category_code: "bombillas", catalog_attributes: { "tipo-bombilla": "apaga" } });
    expect(wholesaleSaleCategory(item)).toBeNull();
  });
});
