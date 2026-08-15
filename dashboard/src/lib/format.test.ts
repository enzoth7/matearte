import { describe, expect, it, vi } from "vitest";
import type { Product, ProductionItem } from "../types";
import { downloadCsv, findProduct, formatDate, getLineValueArg, normalizeText } from "./format";

const product: Product = {
  id: "1",
  model: "Bombillón",
  variant: "Pico de Loro",
  rimType: "-",
  leatherType: "",
  priceArg: 15070,
  priceUyu: 391.82,
};

const line: ProductionItem = {
  lineId: "line-1",
  orderId: "PED-100001",
  customer: "Cliente",
  model: "Bombillon",
  variant: "Pico de Loro",
  quantity: 3,
  status: "Pendiente",
};

describe("format helpers", () => {
  it("normaliza tildes para compatibilidad con datos legados", () => {
    expect(normalizeText(" Bombillón ")).toBe("bombillon");
    expect(findProduct([product], line)).toEqual(product);
  });

  it("calcula el valor de una línea con el catálogo", () => {
    expect(getLineValueArg([product], line)).toBe(45210);
  });

  it("muestra un guion cuando falta una fecha", () => {
    expect(formatDate(null, true)).toBe("-");
    expect(formatDate("fecha-inválida", true)).toBe("-");
  });

  it("exporta CSV escapando comillas", () => {
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === "a") element.click = click;
      return element;
    });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });

    downloadCsv("test.csv", [["Cliente", "Modelo"], ['Casa "Sur"', "Torpedo"]]);

    expect(click).toHaveBeenCalledOnce();
  });
});
