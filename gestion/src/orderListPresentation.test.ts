import { describe, expect, it } from "vitest";
import type { Order, Product } from "./data";
import { orderCategoryLabels, orderShippingStatus } from "./orderListPresentation";

const order = {
  id: "order-1",
  productId: "wholesale:1",
  production: "Terminado",
  delivery: "Enviado",
  items: [
    { productId: "wholesale:1", family: "Torpedo" },
    { productId: "bombilla:1", family: "Bombillas" },
  ],
} as Order;

describe("presentación resumida de ventas y pedidos", () => {
  it("muestra categorías únicas en lugar de nombres o modelos", () => {
    const products = [
      { id: "wholesale:1", categoryCode: "mates", family: "Mates" },
      { id: "bombilla:1", categoryCode: "bombillas", family: "Bombillas" },
    ] as Product[];
    expect(orderCategoryLabels(order, products)).toBe("Mates, Bombillas");
  });

  it("traduce las categorías internas y unifica los personalizados locales", () => {
    const products = [
      { id: "posa:1", categoryCode: "posa-mates", name: "Posa mate cuero crudo" },
      { id: "mate:1", categoryCode: "personalizados", name: "Mate a medida" },
      { id: "matera:1", categoryCode: "personalizados", name: "Matera personalizada" },
    ] as Product[];
    expect(orderCategoryLabels({ ...order, items: products.map((product) => ({ productId: product.id, family: product.categoryCode })) } as Order, products))
      .toBe("Posa mates, Personalizados");
  });

  it("solo muestra Enviado con producción terminada, entrega registrada y pago acreditado", () => {
    expect(orderShippingStatus(order, true)).toBe("Enviado");
    expect(orderShippingStatus({ ...order, production: "En producción" }, true)).toBe("No enviado");
    expect(orderShippingStatus(order, false)).toBe("No enviado");
    expect(orderShippingStatus({ ...order, delivery: "Pendiente" }, true)).toBe("No enviado");
  });
});
