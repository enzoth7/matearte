import { describe, expect, it } from "vitest";
import { allowedSalesChannels, canAccess, setAreaAccess, setPageAccess, visibleCustomers, visibleOrders } from "./access";
import { seedFixture as seed } from "./testing/fixture";

describe("visibilidad de los tres perfiles", () => {
  it("permite habilitar y deshabilitar cada subpestaña de Analítica", () => {
    const owner = seed();
    const other = { ...owner, activeUserId: 't5' };
    for (const page of ['recorridos', 'google-analytics', 'clarity', 'vercel', 'cambios']) {
      const path = '/analitica/' + page;
      expect(canAccess(owner, path)).toBe(true);
      expect(canAccess(other, path)).toBe(false);
      expect(canAccess(setPageAccess(other, 't5', path, true), path)).toBe(true);
      expect(canAccess(setPageAccess(setPageAccess(other, 't5', path, true), 't5', path, false), path)).toBe(false);
    }
  });
  it("mantiene Marketing como acceso inicial de Betiana y permite configurarle otras secciones", () => {
    const s = { ...seed(), activeUserId: "t5", user: "Betiana" };
    expect(canAccess(s, "/marketing/campanas")).toBe(true);
    expect(canAccess(s, "/marketing/avisos")).toBe(true);
    expect(canAccess(s, "/marketing/descuentos")).toBe(true);
    expect(canAccess(s, "/comercial/avisos")).toBe(false);
    expect(canAccess(s, "/comercial/pedidos")).toBe(false);
    expect(canAccess(s, "/finanzas/resumen")).toBe(false);
    expect(visibleOrders(s)).toEqual([]);
    expect(visibleCustomers(s)).toEqual([]);
    const withOrders = setPageAccess(s, "t5", "/comercial/pedidos", true);
    expect(canAccess(withOrders, "/comercial/pedidos")).toBe(true);
    expect(canAccess(withOrders, "/comercial/registrar-min")).toBe(false);
    expect(visibleOrders(withOrders)).toEqual(s.orders);
    expect(visibleCustomers(withOrders)).toEqual(s.customers);
    const withProducts = setAreaAccess(s, "t5", "productos", true);
    expect(canAccess(withProducts, "/productos/catalogo")).toBe(true);
    expect(canAccess(withProducts, "/productos/personalizador")).toBe(true);
    expect(canAccess(setPageAccess(s, "t5", "/finanzas/resumen", true), "/finanzas/resumen")).toBe(true);
  });
  it("ubica egresos y gastos fijos en Finanzas y usa solo permisos de subpestaña", () => {
    const richard = seed();
    expect(canAccess(richard, "/finanzas/resumen")).toBe(true);
    expect(canAccess(richard, "/administracion/usuarios")).toBe(true);
    for (const id of ["t2", "t3"]) {
      const s = { ...richard, activeUserId: id };
      expect(canAccess(s, "/finanzas/egresos")).toBe(true);
      expect(canAccess(s, "/finanzas/gastos-fijos")).toBe(true);
      expect(canAccess(s, "/inventario/compras")).toBe(false);
      expect(canAccess(s, "/finanzas/resumen")).toBe(false);
      expect(canAccess(s, "/administracion/usuarios")).toBe(false);
      expect(canAccess(setPageAccess(s, id as "t2" | "t3", "/finanzas/resumen", true), "/finanzas/resumen")).toBe(true);
      expect(canAccess(setPageAccess(s, id as "t2" | "t3", "/administracion/usuarios", true), "/administracion/usuarios")).toBe(true);
    }
    const readonly = { ...richard, activeUserId: "t5", access: { ...richard.access, t5: ["/finanzas/egresos"] } };
    expect(canAccess(readonly, "/finanzas/egresos")).toBe(true);
    expect(canAccess(readonly, "/finanzas/gastos-fijos")).toBe(false);
    const legacy = { ...richard, activeUserId: "t5", access: { ...richard.access, t5: ["/finanzas/egresos", "/finanzas/editar-egresos"] } };
    expect(setPageAccess(legacy, "t5", "/finanzas/gastos-fijos", true).access?.t5).toEqual(["/finanzas/egresos", "/finanzas/gastos-fijos"]);
  });

  it("muestra a Costa todos los pedidos y mantiene sus permisos de registro y clientes", () => {
    const s = { ...seed(), activeUserId: "t2", user: "Florencia Costa" };
    expect(canAccess(s, "/comercial/registrar-min")).toBe(true);
    expect(canAccess(s, "/comercial/registrar-may")).toBe(false);
    expect(canAccess(s, "/produccion/resumen")).toBe(false);
    expect(allowedSalesChannels(s)).toEqual(["Web", "Local", "Feria", "Instagram", "Facebook", "WhatsApp"]);
    expect(visibleOrders(s)).toEqual(s.orders);
    expect(visibleOrders(s, true)).toEqual(s.orders);
    expect(visibleOrders(s).some((order) => order.channel === "Web")).toBe(true);
    expect(visibleOrders(s).some((order) => order.source === "wholesale")).toBe(true);
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

  it("permite ajustar visibilidad de todas las subpestañas", () => {
    const s = { ...seed(), activeUserId: "t2", user: "Florencia Costa" };
    const next = setPageAccess(s, "t2", "/productos/catalogo", true);
    expect(canAccess(next, "/productos/catalogo")).toBe(true);
    expect(canAccess(next, "/productos/ajustes")).toBe(false);
    const withWholesaleRegister = setPageAccess(next, "t2", "/comercial/registrar-may", true);
    expect(canAccess(withWholesaleRegister, "/comercial/registrar-min")).toBe(true);
    expect(canAccess(withWholesaleRegister, "/comercial/registrar-may")).toBe(true);
    expect(canAccess(setPageAccess(next, "t2", "/administracion/usuarios", true), "/administracion/usuarios")).toBe(true);
    const inventory = setAreaAccess(next, "t2", "inventario", true);
    expect(canAccess(inventory, "/inventario/insumos")).toBe(true);
    expect(canAccess(setPageAccess(inventory, "t2", "/inventario/reventa", false), "/inventario/reventa")).toBe(false);
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
