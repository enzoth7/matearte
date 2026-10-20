import { describe, expect, it } from "vitest";
import { compactOrderItemName, orderItemColor, orderItemDetailRows } from "./orderItemPresentation";

describe("presentación compacta de artículos vendidos", () => {
  it("muestra el nombre del producto sin color, variante ni tamaño", () => {
    expect(compactOrderItemName({
      title: "Mate Imperial Fleje Pampa — Marrón · Tamaño Todos los tamaños",
    })).toBe("Mate Imperial Fleje Pampa");
  });

  it("prioriza el nombre explícito del catálogo", () => {
    expect(compactOrderItemName({ title: "Título histórico", productName: "Mate Imperial Fleje Pampa" })).toBe("Mate Imperial Fleje Pampa");
  });

  it("deja color, tamaño y variante disponibles como detalle", () => {
    expect(orderItemDetailRows({
      title: "Mate Imperial Fleje Pampa",
      productName: "Mate Imperial Fleje Pampa",
      variant: "Marrón",
      rim: "Alpaca",
      leather: "Liso",
      sku: "MATE-01",
      options: { color: "marron", tamano: "todos" },
    })).toEqual([
      { label: "Color", value: "Marrón" },
      { label: "Tamaño", value: "Todos los tamaños" },
      { label: "Virola", value: "Alpaca" },
      { label: "Cuero", value: "Liso" },
      { label: "SKU", value: "MATE-01" },
    ]);
  });

  it("recupera el color de una variante histórica sin confundir otros detalles con color", () => {
    const item = { title: "Mate", sku: "", rim: "", leather: "" };
    expect(orderItemColor({ ...item, variant: "Marrón · Tamaño Todos los tamaños" })).toBe("Marrón");
    expect(orderItemColor({ ...item, variant: "Cuero marrón" })).toBe("Marrón");
    expect(orderItemColor({ ...item, variant: "Sin posa mate" })).toBe("—");
  });
});
