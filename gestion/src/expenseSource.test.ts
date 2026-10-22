import { describe, expect, it } from "vitest";
import { adaptExpenses, canReadExpenses, type ExpenseSources } from "./expenseSource";

const sources: ExpenseSources = {
  purchases: [
    { id: "p1", purchased_on: "2026-10-03", description: "Cuero", category: "Materia prima", amount_minor: 150000, currency: "UYU", status: "pagada", paid_on: "2026-10-05" },
    { id: "p2", purchased_on: "2026-10-10", description: "Herramienta", category: "Herramientas y equipos", amount_minor: 2000, currency: "USD", status: "pendiente", paid_on: null },
    { id: "p3", purchased_on: "2026-10-11", description: "Sin cotización", category: "Otros", amount_minor: 1000, currency: "EUR", status: "pagada", paid_on: "2026-10-11" },
  ],
  fixed: [
    { id: "f1", name: "Alquiler", category: "Alquiler", amount_minor: 3000000, currency: "UYU", due_day: 31, starts_on: "2026-08-01", ends_on: null, active: true },
    { id: "f2", name: "Hosting", category: "Software y suscripciones", amount_minor: 500000, currency: "UYU", due_day: null, starts_on: "2026-01-01", ends_on: "2026-11-30", active: true },
    { id: "f3", name: "Inactivo", category: "Otros", amount_minor: 100, currency: "UYU", due_day: 1, starts_on: "2026-01-01", ends_on: null, active: false },
  ],
  payments: [{ id: "x1", fixed_expense_id: "f1", month: "2026-09-01", amount_minor: 3000000, paid_on: "2026-09-02" }],
};

describe("adaptExpenses", () => {
  const { expenses, skipped } = adaptExpenses(sources, { USD: 40 }, "2026-10-21");
  it("cuenta las compras pagadas en su fecha de pago y convierte USD a pesos", () => {
    expect(expenses.find((item) => item.id === "purchase:p1")).toMatchObject({ amount: 1500, date: "2026-10-05", paid: true });
    expect(expenses.find((item) => item.id === "purchase:p2")).toMatchObject({ amount: 800, paid: false, date: "2026-10-10" });
  });
  it("omite las monedas sin cotización y las cuenta", () => {
    expect(expenses.some((item) => item.id === "purchase:p3")).toBe(false);
    expect(skipped).toBe(1);
  });
  it("registra los meses pagados y proyecta el mes actual y los siguientes como por pagar", () => {
    expect(expenses.find((item) => item.id === "fixed:f1:2026-09")).toMatchObject({ paid: true, amount: 30000, date: "2026-09-02" });
    expect(expenses.find((item) => item.id === "fixed:f1:2026-10")).toMatchObject({ paid: false, date: "2026-10-31" });
    expect(expenses.filter((item) => item.id.startsWith("fixed:f1:") && !item.paid)).toHaveLength(12);
  });
  it("respeta la fecha de fin y los gastos inactivos, y no inventa meses pasados sin pago", () => {
    expect(expenses.filter((item) => item.id.startsWith("fixed:f2:")).map((item) => item.date.slice(0, 7))).toEqual(["2026-11", "2026-10"]);
    expect(expenses.some((item) => item.id.startsWith("fixed:f3:"))).toBe(false);
    expect(expenses.some((item) => item.id === "fixed:f1:2026-08")).toBe(false);
  });
  it("copia la regla de acceso de las políticas RLS", () => {
    expect(canReadExpenses({ access_user_id: "t1", allowed_paths: ["/x"] })).toBe(true);
    expect(canReadExpenses({ access_user_id: "t5", allowed_paths: ["/marketing/campanas"] })).toBe(false);
    expect(canReadExpenses({ access_user_id: "t2", allowed_paths: ["/inventario/compras"] })).toBe(true);
    expect(canReadExpenses(null)).toBe(false);
  });
});
