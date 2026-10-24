import { describe, expect, it } from "vitest";
import { topRetailProducts, topViewedProducts } from "./overviewRankings";
import type { Customer, Order, Product } from "./data";

describe("rankings del inicio", () => {
  it("suma unidades minoristas por producto y excluye pedidos mayoristas", () => {
    const item = (productId: string, quantity: number, productName?: string) => ({ productId, quantity, productName, title: productName || productId });
    const orders = [
      { customerId: "minorista", items: [item("variante-1", 2, "Mate Criollo"), item("variante-2", 1, "Mate Criollo")] },
      { customerId: "minorista", source: "local", items: [item("variante-1", 3, "Mate Criollo"), item("variante-3", 2, "Bombilla")] },
      { customerId: "mayorista", items: [item("variante-3", 100, "Bombilla")] },
      { customerId: "minorista", source: "wholesale", items: [item("variante-3", 100, "Bombilla")] },
    ] as Order[];
    const customers = [{ id: "mayorista", segment: "Mayorista" }] as Customer[];
    expect(topRetailProducts(orders, customers, [] as Product[])).toEqual([
      { name: "Mate Criollo", count: 6 }, { name: "Bombilla", count: 2 },
    ]);
  });

  it("agrupa nombres de Analytics y devuelve solo el top 10 por visitantes", () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({ label: `Producto ${index}`, visitors: index + 1 }));
    rows.push({ label: "Producto 10", visitors: 5 });
    const ranking = topViewedProducts(rows);
    expect(ranking).toHaveLength(10);
    expect(ranking[0]).toEqual({ name: "Producto 10", count: 16 });
    expect(ranking.some(item => item.name === "Producto 0")).toBe(false);
  });
});
