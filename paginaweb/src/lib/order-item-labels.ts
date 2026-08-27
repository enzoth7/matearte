export type CommerceItemType = "catalog" | "design";

export function commerceItemKind(itemType: CommerceItemType) {
  return itemType === "design" ? "Mate personalizado" : "Producto del catálogo";
}

export function whatsappOrderItemLine(item: { item_type: CommerceItemType; title: string; quantity: number }) {
  const title = item.item_type === "design" ? `Mate personalizado: ${item.title}` : item.title;
  return `- ${item.quantity} x ${title}`;
}
