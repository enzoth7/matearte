import { formatUYU } from "../catalog/pricingCatalog";

export function formatSelectionPrice(value: number | null, pendingCopy = "Precio no disponible", from = false, isDelta = false) {
  if (value === null) return pendingCopy;
  return isDelta ? `+ ${formatUYU(value)}` : `${from ? "Desde " : ""}${formatUYU(value)}`;
}
