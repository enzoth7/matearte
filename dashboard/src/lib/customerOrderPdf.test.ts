import { describe, expect, it } from "vitest";
import type { CustomerProfile, HistoryItem, Product, ProductionItem } from "../types";
import { createCustomerOrderPdfDocument, getCustomerOrderDueDate, getCustomerOrderPdfFilename, groupCustomerHistoryByOrder } from "./customerOrderPdf";

const products: Product[] = [
  { id: "TOR-NAT", model: "Torpedo", variant: "Natural", rimType: "Alpaca", leatherType: "Cuero crudo", priceArg: 12000, priceUyu: 0 },
  { id: "CRI-ALP", model: "Criollo", variant: "Alpaca", rimType: "Alpaca", leatherType: "Cuero crudo", priceArg: 17000, priceUyu: 0 },
];

const history: HistoryItem[] = [
  { lineId: "line-1", orderId: "PED-2", createdAt: "2026-09-07T12:00:00.000Z", customer: "Nicolás Heili", model: "Torpedo", variant: "Natural", quantity: 2, completedAt: "2026-09-08T12:00:00.000Z", unitPriceArg: 12000, totalArg: 24000 },
  { lineId: "line-2", orderId: "PED-1", createdAt: "2026-09-01T12:00:00.000Z", customer: "Nicolás Heili", model: "Torpedo", variant: "Natural", quantity: 3, completedAt: "2026-09-02T12:00:00.000Z", unitPriceArg: 12000, totalArg: 36000 },
  { lineId: "line-3", orderId: "PED-2", createdAt: "2026-09-07T12:00:00.000Z", customer: "Nicolás Heili", model: "Criollo", variant: "Alpaca", quantity: 1, completedAt: "2026-09-08T12:00:00.000Z", orderType: "no_cost", unitPriceArg: 17000, totalArg: 17000 },
];

const customer: CustomerProfile = {
  fullName: "Nicolás Heili",
  firstName: "Nicolás",
  lastName: "Heili",
  phone: "099 123 456",
  email: "nicolas@example.com",
  address: "Montevideo",
  notes: "",
};

describe("customerOrderPdf", () => {
  it("mantiene separados los productos iguales de pedidos con fechas distintas", () => {
    const orders = groupCustomerHistoryByOrder(history, products);

    expect(orders.map((order) => order.orderId)).toEqual(["PED-2", "PED-1"]);
    expect(orders[0]).toMatchObject({ totalUnits: 3, totalArg: 24000, orderType: "normal" });
    expect(orders[1]).toMatchObject({ totalUnits: 3, totalArg: 36000 });
  });

  it("genera un PDF individual y un nombre de archivo seguro", () => {
    const [order] = groupCustomerHistoryByOrder(history, products);
    const doc = createCustomerOrderPdfDocument(order, products, customer);

    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(3000);
    expect(getCustomerOrderPdfFilename(customer.fullName, order.orderId)).toBe("matearte-nicolas-heili-ped-2.pdf");
    expect(getCustomerOrderDueDate("2026-06-10T12:00:00.000Z")).toBe("10/07/2026");
  });

  it("mantiene en cero el total de un pedido sin costo", () => {
    const noCostItems: HistoryItem[] = [{
      ...history[0],
      orderId: "PED-SC",
      orderType: "no_cost",
      totalArg: 24000,
    }];

    expect(groupCustomerHistoryByOrder(noCostItems, products)[0]).toMatchObject({
      orderId: "PED-SC",
      orderType: "no_cost",
      totalArg: 0,
    });
  });

  it("incluye pedidos activos, les asigna estado y evita duplicar líneas del histórico", () => {
    const activeLine: ProductionItem = {
      lineId: "line-1",
      orderId: "PED-2",
      createdAt: "2026-09-07T12:00:00.000Z",
      customer: "Nicolás Heili",
      model: "Torpedo",
      variant: "Natural",
      quantity: 2,
      status: "En producción",
      unitPriceArg: 12000,
      totalArg: 24000,
    };

    const order = groupCustomerHistoryByOrder([...history, activeLine], products)[0];
    expect(order).toMatchObject({ orderId: "PED-2", status: "En producción", totalUnits: 3, totalArg: 24000 });
    expect(order.items).toHaveLength(2);
  });
});
