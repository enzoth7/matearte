import { canonicalCategoryCode, defaultCatalogTaxonomy } from "../../shared/catalog-taxonomy";
import { isSale, type Customer, type Order, type OrderLine, type Product } from "./data";

const normalized = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLocaleLowerCase("es")
  .replace(/[\s_]+/g, "-");

const categoryAliases: Record<string, string> = {
  mate: "mates",
  bombilla: "bombillas",
  bombillon: "bombillas",
  termo: "termos",
  matera: "materas",
  billetera: "billeteras",
  tarjetero: "tarjeteros",
  bota: "botas",
  cartera: "carteras",
  cinto: "cintos",
  cuchillo: "cuchillos",
  servicio: "servicios",
  "kit-matero": "kits-materos",
  "kit-materos": "kits-materos",
};
const mateModels = new Set(["imperial", "camionero", "criollo", "torpedo"]);

export function purchaseCategoryLabel(value: string | null | undefined, productName?: string) {
  const source = value?.trim() || "";
  if (!source) return "";
  const normalizedValue = normalized(source);
  if (["personalizados", "mates-personalizados", "materas-personalizadas"].includes(normalizedValue)) return "Personalizados";
  if (normalizedValue === "posa-mates") return "Posa mates";
  const looksLikeMate = normalizedValue === "mate"
    || normalizedValue.startsWith("mate-")
    || normalizedValue.split("-").some((part) => mateModels.has(part));
  const code = canonicalCategoryCode(categoryAliases[normalizedValue] || (looksLikeMate ? "mates" : normalizedValue));
  return defaultCatalogTaxonomy.categories.find((category) =>
    category.code === code || normalized(category.label_es) === normalizedValue,
  )?.label_es || source;
}

export function purchaseLineCategoryLabel(item: OrderLine, product?: Product) {
  if (item.orderType === "design" || item.orderType === "local_design" || item.personalization) return "Personalizados";
  return purchaseCategoryLabel(product?.categoryCode || product?.family || item.family, product?.name || item.productName || item.title);
}

export function latestCustomerPurchase(customer: Customer, orders: Order[], products: Product[] = []) {
  const latest = orders.filter(isSale).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!latest) {
    const category = purchaseCategoryLabel(customer.agendaInferredCategory || "");
    return { date: "", category, inferred: Boolean(category) };
  }
  const productsById = new Map(products.map((product) => [product.id, product]));
  const category = [...new Set((latest.items || []).map((item) => {
    const product = productsById.get(item.productId);
    return purchaseLineCategoryLabel(item, product);
  }).filter(Boolean))].join(", ");
  return { date: latest.date, category, inferred: false };
}
