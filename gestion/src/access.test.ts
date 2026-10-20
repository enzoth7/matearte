import { describe, expect, it } from "vitest";
import { allowedSalesChannels, canAccess, defaultAccess, setAreaAccess, setPageAccess, visibleCustomers, visibleOrders } from "./access";
import { seedFixture as seed } from "./testing/fixture";

describe("visibilidad de los tres perfiles", () => {
  it("ubica Marketing aparte y limita el perfil de Betiana", () => {
    const s = { ...seed(), activeUserId: "t5", user: "Betiana" };
    expect(canAccess(s, "/marketing/campanas")).toBe(true);
    expect(canAccess(s, "/marketing/avisos")).toBe(true);
    expect(canAccess(s, "/marketing/descuentos")).toBe(true);
    expect(canAccess(s, "/comercial/avisos")).toBe(false);
    expect(canAccess(s, "/comercial/pedidos")).toBe(false);
    expect(canAccess(s, "/finanzas/resumen")).toBe(false);
    expect(setPageAccess(s, "t5", "/comercial/pedidos", true)).toBe(s);
  });
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

  it("limita a Costa a ventas minoristas y clientes de Local/Web", () => {
    const s = { ...seed(), activeUserId: "t2", user: "Florencia Costa" };
    expect(canAccess(s, "/comercial/registrar-min")).toBe(true);
    expect(canAccess(s, "/comercial/registrar-may")).toBe(false);
    expect(canAccess(s, "/produccion/resumen")).toBe(false);
    expect(allowedSalesChannels(s)).toEqual(["Local", "Feria"]);
    expect(visibleOrders(s).every((order) => order.channel === "Local")).toBe(true);
    const customerIds = new Set(s.orders.filter((order) => order.channel === "Web").map((order) => order.customerId));
    expect(visibleCustomers(s).some((customer) => customerIds.has(customer.id))).toBe(true);
  });

  it("limita a Pizzorno a Mayorista en ventas y le muestra toda Producción", () => {
    const s = { ...seed(), activeUserId: "t3", user: "Florencia Pizzorno" };
    expect(canAccess(s, "/comercial/registrar-min")).toBe(false);
    expect(canAccess(s, "/comercial/registrar-may")).toBe(true);
    expect(canAccess(s, "/produccion/resumen")).toBe(true);
    expect(canAccess(s, "/produccion/personalizados")).toBe(true);
    expect(canAccess(s, "/productos/personalizador")).toBe(true);
    expect(visibleOrders(s).every((order) => order.source === "wholesale" || (order.channel === "Web" && s.customers.some((customer) => customer.id === order.customerId && customer.segment === "Mayorista")))).toBe(true);
    expect(visibleOrders(s, true)).toHaveLength(s.orders.length);
  });

  it("permite ajustar visibilidad de subáreas sin otorgar las reservadas", () => {
    const s = { ...seed(), activeUserId: "t2", user: "Florencia Costa" };
    const next = setPageAccess(s, "t2", "/productos/catalogo", true);
    expect(canAccess(next, "/productos/catalogo")).toBe(true);
    expect(canAccess(next, "/productos/ajustes")).toBe(false);
    const withWholesaleRegister = setPageAccess(next, "t2", "/comercial/registrar-may", true);
    expect(canAccess(withWholesaleRegister, "/comercial/registrar-min")).toBe(true);
    expect(canAccess(withWholesaleRegister, "/comercial/registrar-may")).toBe(true);
    expect(canAccess(setPageAccess(next, "t2", "/administracion/usuarios", true), "/administracion/usuarios")).toBe(false);
  });

  it("separa los permisos de pedidos personalizados y del configurador", () => {
    const s = { ...seed(), activeUserId: "t3", user: "Florencia Pizzorno" };
    const withoutConfigurator = setPageAccess(s, "t3", "/productos/personalizador", false);
    expect(canAccess(withoutConfigurator, "/produccion/personalizados")).toBe(true);
    expect(canAccess(withoutConfigurator, "/productos/personalizador")).toBe(false);
    const withoutOrders = setPageAccess(s, "t3", "/produccion/personalizados", false);
    expect(canAccess(withoutOrders, "/produccion/personalizados")).toBe(false);
    expect(canAccess(withoutOrders, "/productos/personalizador")).toBe(true);
  });
});
