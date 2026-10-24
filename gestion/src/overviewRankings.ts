import type { Customer, Order, Product } from "./data";

export type RankingItem = { name: string; count: number };
export type ProductView = { label: string; visitors: number };

export function topRetailProducts(orders: Order[], customers: Customer[], products: Product[]): RankingItem[] {
  const wholesaleCustomers = new Set(customers.filter(customer => customer.segment === "Mayorista").map(customer => customer.id));
  const productNames = new Map(products.map(product => [product.id, product.name]));
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (order.source === "wholesale" || wholesaleCustomers.has(order.customerId)) continue;
    for (const item of order.items || []) {
      const name = (item.productName || productNames.get(item.productId) || item.title).trim();
      if (name && item.quantity > 0) counts.set(name, (counts.get(name) || 0) + item.quantity);
    }
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es")).slice(0, 10);
}

export function topViewedProducts(rows: ProductView[]): RankingItem[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.label.trim();
    if (name && Number.isFinite(row.visitors) && row.visitors > 0) counts.set(name, (counts.get(name) || 0) + row.visitors);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es")).slice(0, 10);
}
