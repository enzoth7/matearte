import type { Order, OrderLine, Product } from "./data";

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");

export function naturalCaseName(value: string): string {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean || /\p{Ll}/u.test(clean)) return clean;
  return clean.toLocaleLowerCase("es").replace(/(^|[\s/\-–—])\p{L}/gu, (letter) => letter.toLocaleUpperCase("es"));
}

export function isPersonalizedMateProduct(product: Product | undefined): boolean {
  if (!product) return false;
  const category = normalized(product.categoryCode || product.family || "");
  if (category === "mates-personalizados" || category === "materas-personalizadas" || category === "personalizados") return true;
  return category.includes("personaliz") && /\bmate(?:ra)?\b/.test(normalized(product.name));
}

export function isPersonalizedMateItem(order: Order, item: OrderLine, products: Product[]): boolean {
  if (item.orderType === "design" || item.orderType === "local_design") return true;
  if (order.source === "local") return Boolean(item.personalization);
  const product = products.find((entry) => entry.id === item.productId);
  if (isPersonalizedMateProduct(product)) return true;
  return Boolean(order.design && item.reviewStatus != null && /\bmate(?:ra)?\b/.test(normalized(item.productName || item.title || "")));
}

export function isPersonalizedMateOrder(order: Order, products: Product[]): boolean {
  return (order.items || []).some((item) => isPersonalizedMateItem(order, item, products));
}

export function withoutPersonalizedMateItems(order: Order, products: Product[]): Order | null {
  if (!order.items?.length) return isPersonalizedMateOrder(order, products) ? null : order;
  const items = order.items.filter((item) => !isPersonalizedMateItem(order, item, products));
  if (items.length === order.items.length) return order;
  if (!items.length) return null;
  const production = items.every((item) => item.productionStatus === "completed" || item.productionStatus === "Completado")
    ? "Terminado"
    : items.some((item) => item.productionStatus === "in_production" || item.productionStatus === "En producción")
      ? "En producción"
      : "Pendiente";
  return {
    ...order,
    items,
    productId: items[0].productId,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
    production,
  };
}
