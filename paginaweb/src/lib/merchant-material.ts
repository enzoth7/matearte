import type { Product } from "@/types/catalog";

/** Google accepts one material value, with up to two secondary materials separated by slashes. */
export function merchantMaterial(product: Pick<Product, "materials">): string | undefined {
  const materials = [...new Set(product.materials.map((material) => material.trim()).filter(Boolean))];
  return materials.length > 0 ? materials.slice(0, 3).join(" / ") : undefined;
}
