import type { Locale } from "@/types/catalog";

export type CommerceItemType = "catalog" | "design";

export function commerceItemKind(itemType: CommerceItemType) {
  return itemType === "design" ? "Mate personalizado" : "Producto del catálogo";
}

export function whatsappOrderItemLine(item: { item_type: CommerceItemType; title: string; quantity: number }, locale: Locale = "es") {
  const custom = { es: "Mate personalizado", en: "Custom mate", pt: "Mate personalizado" }[locale];
  const title = item.item_type === "design" ? `${custom}: ${item.title}` : item.title;
  return `- ${item.quantity} x ${title}`;
}
