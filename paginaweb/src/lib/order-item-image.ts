import type { CatalogValueMap } from "../../../shared/catalog-taxonomy";

type ProductImageRow = {
  storage_path: string;
  sort_order: number;
  variant_id: string | null;
  option_values?: CatalogValueMap | null;
};

export type OrderItemImageSource = {
  item_type: "catalog" | "design";
  source_variant_id?: string | null;
  variant?: {
    option_values?: CatalogValueMap | null;
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
  const variantColor = typeof item.variant?.option_values?.color === "string" ? item.variant.option_values.color : null;
  const matchingColor = variantColor ? images.find(image=>image.option_values?.color===variantColor) : null;
  const productDefault = images.find((image) => image.variant_id === null && !image.option_values?.color);

  return matchingColor?.storage_path || matchingVariant?.storage_path || productDefault?.storage_path || images[0]?.storage_path || null;
}
