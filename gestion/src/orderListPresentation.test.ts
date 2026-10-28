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

  it("muestra Personalizados para un diseño web sin variante de catálogo", () => {
    const personalizedOrder = {
      ...order,
      items: [{ productId: "design-1", family: "Sin categoría", title: "Mate Camionero", orderType: "design" }],
    } as Order;
    expect(orderCategoryLabels(personalizedOrder, [])).toBe("Personalizados");
  });

  it("mantiene Personalizados en un diseño local aunque el artículo base sea un mate", () => {
    const personalizedOrder = {
      ...order,
      items: [{ productId: "mate-1", family: "Mates", title: "Mate Criollo", orderType: "local_design" }],
    } as Order;
    const products = [{ id: "mate-1", categoryCode: "mates", family: "Mates" }] as Product[];
    expect(orderCategoryLabels(personalizedOrder, products)).toBe("Personalizados");
  });

  it("respeta el envío registrado aunque otros estados estén desactualizados", () => {
    expect(orderShippingStatus(order)).toBe("Enviado");
    expect(orderShippingStatus({ ...order, production: "En producción" })).toBe("Enviado");
    expect(orderShippingStatus({ ...order, delivery: "Entregado" })).toBe("Entregado");
    expect(orderShippingStatus({ ...order, delivery: "Pendiente", status: "shipped" })).toBe("Enviado");
    expect(orderShippingStatus({ ...order, delivery: "Pendiente", status: "delivered" })).toBe("Entregado");
    expect(orderShippingStatus({ ...order, delivery: "Pendiente" })).toBe("No enviado");
  });
});
