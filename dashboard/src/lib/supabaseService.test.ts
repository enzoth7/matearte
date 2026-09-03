import { describe, expect, it, vi } from "vitest";
import * as supabaseClientModule from "./supabaseClient";
import {
  completeProductionLine,
  createCustomer,
  createOrder,
  createProduct,
  deleteProductionLine,
  fetchDashboardData,
  mergeOrUpdateCustomer,
  updateExchangeRate,
  updateProductionLine,
  updateProduct,
} from "./supabaseService";

describe("supabaseService", () => {
  it("lanza un error si el cliente supabase no está inicializado", async () => {
    vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue(null as any);

    await expect(fetchDashboardData()).rejects.toThrow("Cliente de Supabase no configurado.");
  });

  it("fetchDashboardData mapea correctamente la estructura de datos", async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "settings") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { source: "test", generated_at: "2026-08-19", exchange_rate: 0.026 },
              error: null,
            }),
          };
        }
        if (table === "products") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { id: "1", model: "Imperial", variant: "Negro", rim_type: "Alpaca", leather_type: "Vaqueta", price_arg: 50000, price_uyu: 1300 },
              ],
              error: null,
            }),
          };
        }
        if (table === "customers") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { full_name: "JUAN PEREZ", first_name: "JUAN", last_name: "PEREZ", phone: "099123456", email: "", address: "", notes: "" },
              ],
              error: null,
            }),
          };
        }
        if (table === "order_lines") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                {
                  line_id: "line-1",
                  order_id: "PED-123",
                  customer: "JUAN PEREZ",
                  model: "Imperial",
                  variant: "Negro",
                  quantity: 2,
                  status: "Pendiente",
                  created_at: "2026-08-19T10:00:00.000Z",
                  completed_at: null,
                  unit_price_arg: 50000,
                  unit_price_uyu: 1300,
                  exchange_rate: 0.026,
                  total_arg: 100000,
                  total_uyu: 2600,
                },
                {
                  line_id: "line-2",
                  order_id: "PED-100",
                  customer: "JUAN PEREZ",
                  model: "Imperial",
                  variant: "Negro",
                  quantity: 1,
                  status: "Completado",
                  created_at: "2026-08-10T10:00:00.000Z",
                  completed_at: "2026-08-12T10:00:00.000Z",
                },
              ],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }),
    };

    vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue(mockClient as any);

    const data = await fetchDashboardData();
    expect(data.exchangeRate).toBe(0.026);
    expect(data.customers).toEqual(["JUAN PEREZ"]);
    expect(data.products).toHaveLength(1);
    expect(data.production).toHaveLength(1);
    expect(data.production[0].lineId).toBe("line-1");
    expect(data.production[0].createdAt).toBe("2026-08-19T10:00:00.000Z");
    expect(data.history).toHaveLength(1);
    expect(data.history[0].lineId).toBe("line-2");
  });

  it("elimina una línea exacta en Supabase y devuelve los datos actualizados", async () => {
    const deleteQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { line_id: "line-1" }, error: null }),
    };
    let orderLinesCalls = 0;
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "order_lines" && orderLinesCalls++ === 0) return deleteQuery;
        if (table === "settings") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { exchange_rate: 0.026 }, error: null }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }),
    };
    vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue(mockClient as any);

    const result = await deleteProductionLine("line-1");

    expect(deleteQuery.delete).toHaveBeenCalledOnce();
    expect(deleteQuery.eq).toHaveBeenCalledWith("line_id", "line-1");
    expect(deleteQuery.select).toHaveBeenCalledWith("line_id");
    expect(result.production).toEqual([]);
  });
});
