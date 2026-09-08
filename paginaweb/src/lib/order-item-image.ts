type ProductImageRow = {
  storage_path: string;
  sort_order: number;
  variant_id: string | null;
};

export type OrderItemImageSource = {
  item_type: "catalog" | "design";
  source_variant_id?: string | null;
  variant?: {
    product?: {
      commerce_product_images?: ProductImageRow[] | null;
    } | null;
  } | null;
};

export function orderItemImagePath(item: OrderItemImageSource) {
  if (item.item_type !== "catalog") return null;

  const images = [...(item.variant?.product?.commerce_product_images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order || a.storage_path.localeCompare(b.storage_path));
  const matchingVariant = item.source_variant_id
    ? images.find((image) => image.variant_id === item.source_variant_id)
    : null;
  const productDefault = images.find((image) => image.variant_id === null);

  return matchingVariant?.storage_path || productDefault?.storage_path || images[0]?.storage_path || null;
}
