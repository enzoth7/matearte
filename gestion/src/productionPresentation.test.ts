import { describe, expect, it } from "vitest";
import type { Order, OrderLine, Product } from "./data";
import { isPersonalizedMateOrder, naturalCaseName, orderProductionLabel, workshopOrderRows } from "./productionPresentation";

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

  it("envía a producción solo personalizados y servicios de Web y Local", () => {
    const products = [product("regular", "Mate Imperial", "mates"), product("custom", "Mate a medida", "personalizados"), product("service", "Grabado", "servicios")];
    const mixed = order([line("custom-line", "custom", "local_design"), line("regular-line", "regular")]);
    const localDesign: Order = { ...order([line("local-design", "custom", "local_design")]), id: "local-design", source: "local", production: "No aplica" };
    const localService: Order = { ...order([line("local-service", "service"), line("local-service-regular", "regular")]), id: "local-service", source: "local", production: "No aplica" };
    const webService: Order = { ...order([line("web-service", "service")]), id: "web-service" };
    const regularLocal: Order = { ...order([line("local-regular", "regular")]), id: "local-regular", source: "local", production: "No aplica" };
    const legacyLocal: Order = { ...order([line("legacy-local-regular", "regular")]), id: "legacy-local", channel: "Local" };
    const regularWeb: Order = { ...order([line("web-regular", "regular")]), id: "web-regular" };
    const wholesaleWeb: Order = { ...order([line("wholesale-web", "regular")]), id: "wholesale-web", channel: "Mayorista" };
    const wholesale: Order = { ...order([line("wholesale-regular", "regular")]), id: "wholesale", source: "wholesale" };
    const cancelled = { ...order([line("cancelled", "custom", "design")]), id: "cancelled", status: "cancelled" };
    expect(isPersonalizedMateOrder(mixed, products)).toBe(true);
    const rows = workshopOrderRows([mixed, localDesign, localService, webService, regularLocal, legacyLocal, regularWeb, wholesaleWeb, wholesale, cancelled], products);
    expect(rows.map((row) => row.id)).toEqual(["order", "local-design", "local-service", "web-service", "wholesale-web", "wholesale"]);
    expect(rows[0].items?.map((item) => item.id)).toEqual(["custom-line"]);
    expect(rows[1].production).toBe("Pendiente");
    expect(rows[2].items?.map((item) => item.id)).toEqual(["local-service"]);
    expect(rows[3].items?.map((item) => item.id)).toEqual(["web-service"]);
    expect(rows[4].items?.map((item) => item.id)).toEqual(["wholesale-web"]);
    expect(rows[5].items?.map((item) => item.id)).toEqual(["wholesale-regular"]);
  });

  it("no confunde un modelo fijo vendido en Local con un encargo diseñado", () => {
    const products = [product("fixed", "Mate personalizado de catálogo", "personalizados")];
    const localLine = line("fixed-line", "fixed");
    const localOrder = { ...order([localLine]), source: "local" as const };
    expect(isPersonalizedMateOrder(localOrder, products)).toBe(false);
    localLine.orderType = "local_design";
    expect(isPersonalizedMateOrder(localOrder, products)).toBe(true);
  });

  it("no envía un fiado por categoría Servicios al taller", () => {
    const serviceCredit = { ...order([{ ...line("service-credit", "category", "credit_category"), family: "Servicios" }]), source: "local" as const };
    expect(workshopOrderRows([serviceCredit], [])).toHaveLength(0);
    expect(orderProductionLabel(serviceCredit, [])).toBe("-");
  });

  it("excluye todos los fiados locales de producción aunque un renglón parezca un servicio", () => {
    const products = [product("service", "Grabado", "servicios")];
    const credit = { ...order([line("service-line", "service", "service")]), source: "local" as const, paymentMethod: "Cuenta corriente" };
    expect(workshopOrderRows([credit], products)).toHaveLength(0);
    expect(orderProductionLabel(credit, products)).toBe("-");
  });

  it("muestra guion para stock y mantiene pendiente un pedido mixto hasta completar todos sus artículos", () => {
    const products = [product("regular", "Mate Imperial", "mates"), product("custom", "Mate a medida", "personalizados")];
    const stock = order([line("stock", "regular")]);
    expect(orderProductionLabel(stock, products)).toBe("-");
    expect(orderProductionLabel({ ...stock, source: "local", channel: "WhatsApp", production: "No aplica" }, products)).toBe("-");

    const customLine = { ...line("custom", "custom", "design"), productionStatus: "completed" };
    const stockLine = line("stock", "regular");
    const mixed = order([customLine, stockLine]);
    expect(workshopOrderRows([mixed], products)[0].items?.map((item) => item.id)).toEqual(["custom"]);
    expect(orderProductionLabel(mixed, products)).toBe("Pendiente");
    expect(orderProductionLabel({ ...mixed, items: [customLine, { ...stockLine, productionStatus: "completed" }] }, products)).toBe("Terminado");
  });
});
