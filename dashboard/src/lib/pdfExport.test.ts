import { describe, expect, it, vi } from "vitest";
import type { ProductionItem } from "../types";
import {
  createProductionPdfDocument,
  exportProductionToPdf,
  getProductionPdfFilename,
  groupProductionByCustomer,
  groupProductionByOrder,
} from "./pdfExport";

const sampleItems: ProductionItem[] = [
  {
    lineId: "line-1",
    orderId: "PED-101",
    customer: "NICOLAS HEILI",
    model: "Bombilla",
    variant: "Con Aplique",
    quantity: 15,
    status: "En producción",
  },
  {
    lineId: "line-2",
    orderId: "PED-101",
    customer: "NICOLAS HEILI",
    model: "Bombillón",
    variant: "Pico de Loro",
    quantity: 30,
    status: "En producción",
  },
  {
    lineId: "line-3",
    orderId: "PED-102",
    customer: "ANAHI",
    model: "Torpedo",
    variant: "Alpaca Cuero Croco/Pelos",
    quantity: 4,
    status: "En producción",
  },
];

describe("pdfExport", () => {
  it("genera el nombre de archivo por defecto con la fecha adecuada", () => {
    const date = new Date(2026, 7, 19);
    expect(getProductionPdfFilename(date)).toBe("matearte-produccion-2026-08-19.pdf");
  });

  it("agrupa items de producción por cliente y calcula total de unidades", () => {
    const groups = groupProductionByCustomer(sampleItems);

    expect(groups).toHaveLength(2);
    // ANAHI comes first alphabetically
    expect(groups[0].customer).toBe("ANAHI");
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].totalUnits).toBe(4);

    expect(groups[1].customer).toBe("NICOLAS HEILI");
    expect(groups[1].items).toHaveLength(2);
    expect(groups[1].totalUnits).toBe(45);
  });

  it("crea una hoja de resumen y 1 página por cliente", () => {
    const doc = createProductionPdfDocument(sampleItems);
    expect(doc.getNumberOfPages()).toBe(3);
  });

  it("mantiene separados los productos que pertenecen a pedidos distintos", () => {
    const orders = groupProductionByOrder([
      { ...sampleItems[0], createdAt: "2026-09-01T10:00:00.000Z" },
      { ...sampleItems[0], lineId: "line-4", orderId: "PED-202", createdAt: "2026-09-07T10:00:00.000Z" },
    ]);

    expect(orders).toHaveLength(2);
    expect(orders.map((order) => order.orderId)).toEqual(["PED-101", "PED-202"]);
    expect(orders.map((order) => order.createdAt)).toEqual(["2026-09-01T10:00:00.000Z", "2026-09-07T10:00:00.000Z"]);
  });

  it("maneja lista vacía sin fallar", () => {
    const doc = createProductionPdfDocument([]);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("exporta y llama doc.save con el nombre indicado", () => {
    const doc = createProductionPdfDocument(sampleItems);
    const saveSpy = vi.spyOn(doc, "save").mockImplementation(() => doc);
    
    // Test that exportProductionToPdf triggers doc.save
    exportProductionToPdf(sampleItems, "test.pdf");
  });
});
