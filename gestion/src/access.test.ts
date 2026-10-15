import { describe, expect, it } from "vitest";
import { canAccess, defaultAccess, setAreaAccess, setPageAccess, visibleCustomers, visibleOrders } from "./access";
import { seedFixture as seed } from "./testing/fixture";

describe("visibilidad de los tres perfiles", () => {
  it("deja toda la gestión a Richard y reserva Finanzas y Usuarios para él", () => {
    const richard = seed();
    expect(canAccess(richard, "/finanzas/resumen")).toBe(true);
    expect(canAccess(richard, "/administracion/usuarios")).toBe(true);
    for (const id of ["t2", "t3"]) {
      const s = { ...richard, activeUserId: id };
      expect(canAccess(s, "/finanzas/resumen")).toBe(false);
      expect(canAccess(s, "/administracion/usuarios")).toBe(false);
      expect(setAreaAccess(s, id as "t2" | "t3", "finanzas", true).access?.[id]).toEqual(defaultAccess()[id]);
      expect(setPageAccess(s, id as "t2" | "t3", "/finanzas/egresos", true).access?.[id]).toEqual(defaultAccess()[id]);
    }
  });

  it("limita a Costa a Local y clientes de Local/Web", () => {
    const s = { ...seed(), activeUserId: "t2", user: "Florencia Costa" };
    expect(canAccess(s, "/comercial/registrar")).toBe(true);
    expect(canAccess(s, "/produccion/resumen")).toBe(false);
    expect(visibleOrders(s).every((order) => order.channel === "Local")).toBe(true);
    const customerIds = new Set(s.orders.filter((order) => order.channel === "Web").map((order) => order.customerId));
    expect(visibleCustomers(s).some((customer) => customerIds.has(customer.id))).toBe(true);
  });

  it("limita a Pizzorno a Mayorista en ventas y le muestra toda Producción", () => {
    const s = { ...seed(), activeUserId: "t3", user: "Florencia Pizzorno" };
    expect(canAccess(s, "/produccion/resumen")).toBe(true);
    expect(visibleOrders(s).every((order) => order.channel === "Mayorista")).toBe(true);
    expect(visibleOrders(s, true)).toHaveLength(s.orders.length);
  });

  it("permite ajustar visibilidad de subáreas sin otorgar las reservadas", () => {
    const s = { ...seed(), activeUserId: "t2", user: "Florencia Costa" };
    const next = setPageAccess(s, "t2", "/productos/catalogo", true);
    expect(canAccess(next, "/productos/catalogo")).toBe(true);
    expect(canAccess(next, "/productos/ajustes")).toBe(false);
    expect(canAccess(setPageAccess(next, "t2", "/administracion/usuarios", true), "/administracion/usuarios")).toBe(false);
  });
});
