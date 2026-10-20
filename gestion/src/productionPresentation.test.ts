import { describe, expect, it } from "vitest";
import type { Order, OrderLine, Product } from "./data";
import { isPersonalizedMateOrder, naturalCaseName, withoutPersonalizedMateItems } from "./productionPresentation";

const product = (id: string, name: string, categoryCode: string): Product => ({
  id, name, categoryCode, family: categoryCode, sku: id, variant: "Marrón", rim: "", leather: "", cost: 0,
  prices: { Local: 0, Web: 0, Mayorista: 0 }, stock: 0, min: 0, published: true,
});
const line = (id: string, productId: string, orderType?: string): OrderLine => ({
  id, productId, orderType, title: "MATE PERSONALIZADO", sku: id, quantity: 1, unitPrice: 100, amount: 100,
  family: "", variant: "", rim: "", leather: "", productionStatus: "pending", reviewStatus: null,
});
const order = (items: OrderLine[]): Order => ({
  id: "order", customerId: "customer", productId: items[0]?.productId || "", quantity: items.length, unitPrice: 0,
  items, channel: "Web", date: "2026-10-19", due: "", production: "Pendiente", delivery: "Pendiente",
  method: "Envío", design: items.some((item) => item.orderType === "design"), approved: true,
});

describe("presentación de producción", () => {
  it("corrige sólo nombres escritos completamente en mayúsculas", () => {
    expect(naturalCaseName("MATE IMPERIAL PAMPA")).toBe("Mate Imperial Pampa");
    expect(naturalCaseName("Mate Imperial Pampa")).toBe("Mate Imperial Pampa");
  });

  it("reconoce personalizados Web y Local y los separa de la producción general", () => {
    const products = [product("regular", "Mate Imperial", "mates"), product("custom", "Mate a medida", "personalizados")];
    const mixed = order([line("custom-line", "custom", "local_design"), line("regular-line", "regular")]);
    expect(isPersonalizedMateOrder(mixed, products)).toBe(true);
    expect(withoutPersonalizedMateItems(mixed, products)?.items?.map((item) => item.id)).toEqual(["regular-line"]);
    expect(withoutPersonalizedMateItems(order([line("design", "missing", "design")]), products)).toBeNull();
  });

  it("no confunde un modelo fijo vendido en Local con un encargo diseñado", () => {
    const products = [product("fixed", "Mate personalizado de catálogo", "personalizados")];
    const localLine = line("fixed-line", "fixed");
    const localOrder = { ...order([localLine]), source: "local" as const };
    expect(isPersonalizedMateOrder(localOrder, products)).toBe(false);
    localLine.orderType = "local_design";
    expect(isPersonalizedMateOrder(localOrder, products)).toBe(true);
  });
});
