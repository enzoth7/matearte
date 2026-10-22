import type { Order, Product } from "./data";
import { purchaseCategoryLabel, purchaseLineCategoryLabel } from "./customerPurchase";

export function orderCategoryLabels(order: Order, products: Product[]) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const values = order.items?.length
    ? order.items.map((item) => {
        const product = productsById.get(item.productId);
        return purchaseLineCategoryLabel(item, product);
      })
    : [purchaseCategoryLabel(productsById.get(order.productId)?.categoryCode || productsById.get(order.productId)?.family, productsById.get(order.productId)?.name)];
  return [...new Set(values.filter(Boolean))].join(", ") || "Sin categoría";
}

export function orderShippingStatus(order: Order): "No enviado" | "Enviado" {
  return order.status === "shipped" || order.delivery === "Enviado" || order.delivery === "Entregado" ? "Enviado" : "No enviado";
}
