import { defaultCatalogTaxonomy, formatPurchaseSelectionLabel, normalizeCatalogValueMap } from "../../../shared/catalog-taxonomy";

export function orderSelectionLabel(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const record = snapshot as Record<string, unknown>;
  const selected = normalizeCatalogValueMap(record.selectedOptions);
  if (Object.keys(selected).length === 0) return null;
  return formatPurchaseSelectionLabel(defaultCatalogTaxonomy, selected);
}
