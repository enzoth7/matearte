import { describe, expect, it } from "vitest";
import { orderSelectionLabel } from "./order-selection";

describe("medida conservada en el pedido", () => {
  it("muestra color y tamaño elegidos desde el registro inmutable", () => {
    expect(orderSelectionLabel({ selectedOptions: { color: "natural", tamano: "mediano" } })).toBe("Natural · Tamaño: Mediano");
    expect(orderSelectionLabel({ selectedOptions: { color: "negro", talle: "38" } })).toBe("Negro · Talle: 38");
    expect(orderSelectionLabel({ selectedOptions: { color: "natural", tamano: "mediano", interior: "ceramica" } })).toBe("Natural · Interior: Cerámica · Tamaño: Mediano");
  });

  it("omite la selección cuando el pedido histórico no la tiene", () => {
    expect(orderSelectionLabel({})).toBeNull();
  });
});
