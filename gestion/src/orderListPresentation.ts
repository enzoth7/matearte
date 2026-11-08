import { isSale, type Order, type Product } from "./data";
import { purchaseCategoryLabel, purchaseLineCategoryLabel } from "./customerPurchase";
import { isWorkshopServiceItem } from "./productionPresentation";

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

export function orderShippingStatus(order: Order): "No enviado" | "Enviado" | "Entregado" {
  if (order.status === "delivered" || order.delivery === "Entregado") return "Entregado";
  return order.status === "shipped" || order.delivery === "Enviado" ? "Enviado" : "No enviado";
}

export function isInPersonStockSale(order: Order): boolean {
  const items = order.items || [];
  return order.source === "local"
    && (order.channel === "Local" || order.channel === "Feria")
    && items.length > 0
    && items.every((item) => !item.personalization && !["local_design", "design"].includes(item.orderType || "") && !isWorkshopServiceItem(item));
}

export function isDeliveryOrder(order: Order): boolean {
  return isSale(order) && (order.source !== "wholesale" || Boolean(order.consignmentId)) && !isInPersonStockSale(order);
}
