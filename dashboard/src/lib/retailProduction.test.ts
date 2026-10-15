import { describe, expect, it } from "vitest";
import { mapRetailProduction } from "./retailProduction";

describe("mapRetailProduction", () => {
  it("combina pedidos web y ventas locales con el detalle necesario para producción", () => {
    const result = mapRetailProduction(
      [{
        id: "order-1",
        order_number: 48,
        status: "ready_for_production",
        created_at: "2026-10-04T22:48:09.101Z",
        customer_snapshot: { fullName: "Cliente Web" },
        order_items: [{ id: "item-1", title: "Mate Imperial · Marrón", quantity: 2, production_status: "in_production" }],
      }],
      [{
        id: "sale-1",
        sale_number: 7,
        customer_name: "Cliente Local",
        sold_on: "2026-10-05",
        created_at: "2026-10-05T12:00:00.000Z",
        local_sale_items: [{ id: "local-item-1", product_name: "Bombilla", variant_name: "Alpaca", quantity: 1, production_status: "completed" }],
      }],
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ source: "Local", sourceItemId: "local-item-1", reference: "#00007", status: "completed" });
    expect(result[1]).toMatchObject({ source: "Web", sourceItemId: "item-1", reference: "#48", status: "in_production", quantity: 2 });
  });

  it("prioriza la referencia nueva sin alterar la compatibilidad con pedidos anteriores", () => {
    const result = mapRetailProduction(
      [{ id: "web-new", order_number: 51, reference_code: "#W001", status: "ready_for_production", created_at: "2026-10-14T12:00:00Z", customer_snapshot: {}, order_items: [{ id: "web-item", title: "Mate", quantity: 1, production_status: "pending" }] }],
      [{ id: "local-new", sale_number: 20, reference_code: "#L001", customer_name: "Cliente", sold_on: "2026-10-14", created_at: "2026-10-14T13:00:00Z", local_sale_items: [{ id: "local-item", product_name: "Bombilla", variant_name: "", quantity: 1, production_status: "pending" }] }],
    );
    expect(result.map((item) => item.reference)).toEqual(["#L001", "#W001"]);
  });
});
