import { beforeEach, describe, expect, it } from "vitest";
import type { DashboardData } from "../types";
import { demoRequest } from "./demoDashboard";

describe("demo dashboard", () => {
  beforeEach(() => localStorage.clear());

  it("persiste clientes y pedidos en la sesión del navegador", async () => {
    const initial = await demoRequest<DashboardData>("/api/dashboard");
    await demoRequest<DashboardData>("/api/customers", {
      method: "POST",
      body: JSON.stringify({ fullName: "Cliente Demo", firstName: "Cliente", lastName: "Demo" }),
    });
    const result = await demoRequest<{ data: DashboardData; orderId: string }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({ customer: "Cliente Demo", items: [{ key: "1", productId: initial.products[0].id, quantity: 2 }] }),
    });
    const reloaded = await demoRequest<DashboardData>("/api/dashboard");

    expect(result.orderId).toMatch(/^PED-/);
    expect(reloaded.customers).toContain("Cliente Demo");
    expect(reloaded.production.some((item) => item.orderId === result.orderId && item.quantity === 2)).toBe(true);
  });

  it("crea un nuevo producto en el catálogo", async () => {
    const res = await demoRequest<DashboardData>("/api/products", {
      method: "POST",
      body: JSON.stringify({
        model: "Imperial",
        variant: "Test Nuevo",
        rimType: "Alpaca",
        leatherType: "Vaqueta",
        priceArg: 50000,
      }),
    });
    const created = res.products.find((p) => p.model === "Imperial" && p.variant === "Test Nuevo");
    expect(created).toBeDefined();
    expect(created?.priceArg).toBe(50000);
    expect(created?.priceUyu).toBe(50000 * res.exchangeRate);
  });

  it("elimina una línea de producción y su historial", async () => {
    const initial = await demoRequest<DashboardData>("/api/dashboard");
    const line = initial.production[0];

    const updated = await demoRequest<DashboardData>(`/api/production/${encodeURIComponent(line.lineId)}`, {
      method: "DELETE",
    });

    expect(updated.production.some((item) => item.lineId === line.lineId)).toBe(false);
    expect(updated.history.some((item) => item.lineId === line.lineId)).toBe(false);
  });

  it("guarda snapshots de precios en los pedidos y mantiene su inmutabilidad", async () => {
    const initial = await demoRequest<DashboardData>("/api/dashboard");
    const product = initial.products[0];
    const originalPriceArg = product.priceArg;
    const originalPriceUyu = product.priceUyu;
    const originalRate = initial.exchangeRate;

    const result = await demoRequest<{ data: DashboardData; orderId: string }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customer: "Cliente Inmutable",
        items: [{ key: "1", productId: product.id, quantity: 3 }],
      }),
    });

    const createdLine = result.data.production.find((item) => item.orderId === result.orderId);
    expect(createdLine).toBeDefined();
    expect(createdLine?.unitPriceArg).toBe(originalPriceArg);
    expect(createdLine?.unitPriceUyu).toBe(originalPriceUyu);
    expect(createdLine?.exchangeRate).toBe(originalRate);
    expect(createdLine?.totalArg).toBe(originalPriceArg * 3);
    expect(createdLine?.totalUyu).toBe(originalPriceUyu * 3);

    // Cambiar tipo de cambio y precio del producto
    await demoRequest<DashboardData>("/api/settings/exchange-rate", {
      method: "PUT",
      body: JSON.stringify({ exchangeRate: 0.05 }),
    });
    await demoRequest<DashboardData>(`/api/products/${product.id}`, {
      method: "PATCH",
      body: JSON.stringify({ priceArg: 99999 }),
    });

    const updated = await demoRequest<DashboardData>("/api/dashboard");
    const persistingLine = updated.production.find((item) => item.orderId === result.orderId);

    // Los snapshots en la orden existente deben mantenerse intactos
    expect(persistingLine?.unitPriceArg).toBe(originalPriceArg);
    expect(persistingLine?.totalArg).toBe(originalPriceArg * 3);
    expect(persistingLine?.totalUyu).toBe(originalPriceUyu * 3);
  });

  it("fusiona clientes reasignando pedidos y combinando notas al renombrar hacia un cliente existente", async () => {
    const initial = await demoRequest<DashboardData>("/api/dashboard");
    const pId = initial.products[0].id;

    // Crear Cliente Origen y Cliente Destino
    await demoRequest<DashboardData>("/api/customers", {
      method: "POST",
      body: JSON.stringify({ fullName: "CLIENTE ORIGEN", phone: "099111111", notes: "Nota origen" }),
    });
    await demoRequest<DashboardData>("/api/customers", {
      method: "POST",
      body: JSON.stringify({ fullName: "CLIENTE DESTINO", phone: "099222222", notes: "Nota destino" }),
    });

    // Crear pedidos para Cliente Origen
    const orderRes = await demoRequest<{ data: DashboardData; orderId: string }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customer: "CLIENTE ORIGEN",
        items: [{ key: "1", productId: pId, quantity: 5 }],
      }),
    });

    // Renombrar CLIENTE ORIGEN -> CLIENTE DESTINO (merge)
    const merged = await demoRequest<DashboardData>("/api/customers/CLIENTE%20ORIGEN", {
      method: "PUT",
      body: JSON.stringify({ fullName: "CLIENTE DESTINO", notes: "Nota adicional" }),
    });

    // CLIENTE ORIGEN ya no debe existir en la lista de clientes
    expect(merged.customers).not.toContain("CLIENTE ORIGEN");
    expect(merged.customers).toContain("CLIENTE DESTINO");

    // Las líneas de pedido deben haberse reasignado a CLIENTE DESTINO
    const mergedLine = merged.production.find((l) => l.orderId === orderRes.orderId);
    expect(mergedLine).toBeDefined();
    expect(mergedLine?.customer).toBe("CLIENTE DESTINO");

    // El perfil de CLIENTE DESTINO debe contener las notas combinadas
    const targetProfile = merged.customerProfiles?.find((p) => p.fullName === "CLIENTE DESTINO");
    expect(targetProfile?.notes).toContain("Nota destino");
    expect(targetProfile?.notes).toContain("Nota origen");
  });

  it("restaura los datos originales", async () => {
    await demoRequest<DashboardData>("/api/customers", {
      method: "POST",
      body: JSON.stringify({ fullName: "Temporal", firstName: "Temporal" }),
    });
    const reset = await demoRequest<DashboardData>("/api/reset", { method: "POST" });

    expect(reset.customers).not.toContain("Temporal");
    expect(localStorage.length).toBe(0);
  });
});
