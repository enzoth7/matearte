import { isSale, type Order, type OrderLine, type Product } from "./data";

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
  return Boolean(order.design && item.reviewStatus != null && /personaliz/.test(normalized(`${item.productName || ""} ${item.title || ""}`)));
}

export function isPersonalizedMateOrder(order: Order, products: Product[]): boolean {
  return (order.items || []).some((item) => isPersonalizedMateItem(order, item, products));
}

export function isWorkshopServiceItem(item: OrderLine, products: Product[] = []): boolean {
  if (normalized(item.orderType || "") === "service" || normalized(item.orderType || "") === "servicio") return true;
  if (normalized(item.family || "") === "servicios") return true;
  const product = products.find((entry) => entry.id === item.productId);
  return normalized(product?.categoryCode || product?.family || "") === "servicios";
}

export function productionStatusLabel(status: string): "Pendiente" | "En producción" | "Terminado" {
  return status === "completed" || status === "Completado" || status === "Terminado"
    ? "Terminado"
    : status === "in_production" || status === "En producción"
      ? "En producción"
      : "Pendiente";
}

function orderItemsProductionStatus(items: OrderLine[]): "Pendiente" | "En producción" | "Terminado" {
  return items.length > 0 && items.every((item) => productionStatusLabel(item.productionStatus) === "Terminado")
    ? "Terminado"
    : items.some((item) => productionStatusLabel(item.productionStatus) === "En producción")
      ? "En producción"
      : "Pendiente";
}

export function orderProductionLabel(order: Order, products: Product[]): "Pendiente" | "En producción" | "Terminado" | "-" {
  const workshopOrder = workshopOrderRows([order], products)[0];
  return workshopOrder ? productionStatusLabel(workshopOrder.production) : "-";
}

export function workshopOrderRows(orders: Order[], products: Product[]): Order[] {
  return orders.filter(isSale).flatMap((order) => {
    if (order.source === "wholesale" || (order.source !== "local" && order.channel !== "Web" && order.channel !== "Local")) return [order];
    const workshopItems = (order.items || []).flatMap((item) => {
      if (item.orderType === "credit_category") return [];
      if (isPersonalizedMateItem(order, item, products)) return [{ ...item, orderType: item.orderType === "local_design" ? "local_design" : "design" }];
      return isWorkshopServiceItem(item, products) ? [item] : [];
    });
    if (!workshopItems.length) return [];
    const production = orderItemsProductionStatus(order.items || []);
    return [{ ...order, items: workshopItems, productId: workshopItems[0].productId, quantity: workshopItems.reduce((sum, item) => sum + item.quantity, 0), production }];
  });
}
