export const catalogStatusOptions = ["Todos", "Activos", "Inactivos"] as const;
export const catalogImageOptions = ["Todas", "Con imagen", "Sin imagen"] as const;
export type CatalogStatusFilter = (typeof catalogStatusOptions)[number];
export type CatalogImageFilter = (typeof catalogImageOptions)[number];

export function matchesCatalogStatus(product: { active?: boolean }, filter: CatalogStatusFilter) {
  return filter === "Todos" || Boolean(product.active) === (filter === "Activos");
}

export function matchesCatalogImage(product: { imageUrl?: string }, filter: CatalogImageFilter) {
  return filter === "Todas" || Boolean(product.imageUrl) === (filter === "Con imagen");
}
