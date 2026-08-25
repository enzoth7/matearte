import { describe, expect, it } from "vitest";
import { formatSelectionPrice } from "./selectionPriceUtils";

describe("precio de las opciones del mate", () => {
  it("muestra un estado pendiente cuando todavía no llegó el precio", () => {
    expect(formatSelectionPrice(null)).toBe("Precio no disponible");
    expect(formatSelectionPrice(null, "Precio pendiente", true, true)).toBe("Precio pendiente");
  });

  it("formatea precios base y adicionales disponibles", () => {
    expect(formatSelectionPrice(1800, undefined, true)).toContain("Desde");
    expect(formatSelectionPrice(600, undefined, false, true)).toContain("+");
  });
});
