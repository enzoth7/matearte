import type { Product } from "@/types/catalog";
import { catalogValueLabel, defaultCatalogTaxonomy } from "../../../shared/catalog-taxonomy";

/**
 * Google accepts one material value, with up to two secondary materials separated by slashes.
 * Uses every material checked in Gestión (filterData.materials, e.g. Cuero and Charol) plus the legacy list.
 */
export function merchantMaterial(product: Pick<Product, "materials"> & { filterData?: Pick<Product["filterData"], "materials"> }): string | undefined {
  const fromGestion = (product.filterData?.materials ?? []).map((code) => catalogValueLabel(defaultCatalogTaxonomy, "material", String(code)));
  const seen = new Set<string>();
  const materials = [...fromGestion, ...(product.materials ?? [])]
    .map((material) => material.trim())
    .filter((material) => {
      const key = material.toLocaleLowerCase("es");
      if (!material || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return materials.length > 0 ? materials.slice(0, 3).join(" / ") : undefined;
}
