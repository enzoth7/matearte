import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";
import type { Product, ProductionItem } from "../types";
import {
  buildProductionExportRows,
  createProductionWorkbook,
  downloadCsv,
  exportProductionToExcel,
  findProduct,
  formatDate,
  getLineValueArg,
  getProductionExportFilename,
  normalizeText,
} from "./format";

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

  it("genera nombre de archivo de producción con la fecha correcta", () => {
    const date = new Date(2026, 7, 18);
    expect(getProductionExportFilename(date)).toBe("matearte-produccion-2026-08-18.xlsx");
  });

  it("construye filas de exportación de producción con todos los campos requeridos", () => {
    const customProduct: Product = {
      id: "p-custom",
      model: "Torpedo",
      variant: "Cincelado",
      rimType: "Alpaca",
      leatherType: "Crudo",
      priceArg: 2000,
      priceUyu: 52,
    };
    const customLine: ProductionItem = {
      lineId: "line-custom",
      orderId: null,
      customer: "Juan Pérez",
      model: "Torpedo",
      variant: "Cincelado",
      quantity: 5,
      status: "En producción",
    };

    const rows = buildProductionExportRows([customLine], [customProduct], 0.026);
    expect(rows).toEqual([
      {
        Pedido: "-",
        Cliente: "Juan Pérez",
        Modelo: "Torpedo",
        Variante: "Cincelado",
        Virola: "Alpaca",
        Cuero: "Crudo",
        Cantidad: 5,
        Estado: "En producción",
        "Precio Unitario ARG": 2000,
        "Total ARG": 10000,
        "Total UYU": 260,
      },
    ]);
  });

  it("crea un workbook de producción con la hoja y estructura esperada", () => {
    const workbook = createProductionWorkbook([line], [product], 0.026);
    expect(workbook.SheetNames).toEqual(["Producción"]);
    const sheet = workbook.Sheets["Producción"];
    expect(sheet).toBeDefined();
    const rows = XLSX.utils.sheet_to_json(sheet);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      Pedido: "PED-100001",
      Cliente: "Cliente",
      Modelo: "Bombillon",
      Variante: "Pico de Loro",
      Virola: "-",
      Cuero: "-",
      Cantidad: 3,
      Estado: "Pendiente",
      "Precio Unitario ARG": 15070,
      "Total ARG": 45210,
      "Total UYU": 1175.46,
    });
  });
});
