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
