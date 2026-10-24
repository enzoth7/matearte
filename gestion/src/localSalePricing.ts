import type { Product } from "./data";

export const usesBasePrice = (payment: string) => payment === "Efectivo" || payment === "Transferencia";
export const salePriceMinor = (product: Product, payment: string) =>
  Math.round((usesBasePrice(payment) && Number.isFinite(product.basePrice) ? product.basePrice! : product.prices.Local) * 100);
