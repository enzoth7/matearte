import { describe, expect, it } from "vitest";
import { latestCustomerPurchase, purchaseCategoryLabel } from "./customerPurchase";
import type { Customer, Order, Product } from "./data";

const customer = { id: "agenda-1", name: "Ana Imperial", email: "", phone: "+59899123456", city: "", segment: "Minorista", agendaInferredCategory: "Mates" } as Customer;
const order = { id: "sale-1", customerId: customer.id, date: "2026-10-15", status: "local_sale", channel: "Local", items: [{ family: "Bombillas" }] } as Order;

describe("última compra del contacto de agenda", () => {
  it("no inventa una fecha y mantiene identificada la inferencia", () => {
    expect(latestCustomerPurchase(customer, [])).toEqual({ date: "", category: "Mates", inferred: true });
  });
  it("usa la venta real posterior por encima de la categoría inferida", () => {
    expect(latestCustomerPurchase(customer, [order])).toEqual({ date: "2026-10-15", category: "Bombillas", inferred: false });
  });
  it("ignora un pedido sin cobro confirmado", () => {
    expect(latestCustomerPurchase(customer, [{ ...order, status: "pending_payment" }])).toEqual({ date: "", category: "Mates", inferred: true });
  });
  it("muestra la categoría del catálogo y no el modelo de una línea mayorista", () => {
    const wholesaleOrder = {
      ...order,
      items: [{ productId: "wholesale:7", family: "Torpedo" }],
    } as Order;
    const product = { id: "wholesale:7", categoryCode: "mates", family: "Mates" } as Product;
    expect(latestCustomerPurchase(customer, [wholesaleOrder], [product]).category).toBe("Mates");
  });
  it("normaliza categorías históricas y modelos de mate", () => {
    expect(latestCustomerPurchase(customer, [{ ...order, items: [{ family: "mates-personalizados" }] } as Order]).category).toBe("Personalizados");
    expect(latestCustomerPurchase(customer, [{ ...order, items: [{ family: "Criollo" }] } as Order]).category).toBe("Mates");
    expect(latestCustomerPurchase(customer, [{ ...order, items: [{ family: "Mate Imperial Fleje Pampa" }] } as Order]).category).toBe("Mates");
  });
  it("registra una compra de diseño web como Personalizados", () => {
    const personalizedOrder = {
      ...order,
      items: [{ productId: "design-1", family: "Sin categoría", title: "Mate Camionero", orderType: "design" }],
    } as Order;
    expect(latestCustomerPurchase(customer, [personalizedOrder]).category).toBe("Personalizados");
  });
  it("unifica las categorías históricas de personalizados", () => {
    expect(purchaseCategoryLabel("posa-mates")).toBe("Posa mates");
    expect(purchaseCategoryLabel("personalizados", "Mate a medida")).toBe("Personalizados");
    expect(purchaseCategoryLabel("personalizados", "Matera personalizada")).toBe("Personalizados");
    expect(purchaseCategoryLabel("mates-personalizados")).toBe("Personalizados");
  });
});
