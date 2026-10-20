import type { Order, Product } from "./data";
import { purchaseCategoryLabel } from "./customerPurchase";

export function orderCategoryLabels(order: Order, products: Product[]) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const values = order.items?.length
    ? order.items.map((item) => {
        const product = productsById.get(item.productId);
        return purchaseCategoryLabel(product?.categoryCode || product?.family || item.family, product?.name || item.productName || item.title);
      })
    : [purchaseCategoryLabel(productsById.get(order.productId)?.categoryCode || productsById.get(order.productId)?.family, productsById.get(order.productId)?.name)];
  return [...new Set(values.filter(Boolean))].join(", ") || "Sin categoría";
}

export function orderShippingStatus(order: Order, paymentAccredited: boolean): "No enviado" | "Enviado" {
  const deliveryRecorded = order.delivery === "Enviado" || order.delivery === "Entregado";
  return deliveryRecorded && order.production === "Terminado" && paymentAccredited ? "Enviado" : "No enviado";
}
