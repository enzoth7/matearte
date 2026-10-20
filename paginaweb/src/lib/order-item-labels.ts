import type { Locale } from "@/types/catalog";

export type CommerceItemType = "catalog" | "design";

export function commerceItemKind(itemType: CommerceItemType) {
  return itemType === "design" ? "Diseño personalizado" : "Producto del catálogo";
}

export function whatsappOrderItemLine(item: { item_type: CommerceItemType; title: string; quantity: number }, locale: Locale = "es") {
  const custom = { es: "Diseño personalizado", en: "Personalized design", pt: "Design personalizado" }[locale];
  const title = item.item_type === "design" ? `${custom}: ${item.title}` : item.title;
  return `- ${item.quantity} x ${title}`;
}
