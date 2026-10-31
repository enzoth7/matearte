export function uruguayTransferUnitPriceMinor(publishedUnitPriceMinor: number): number {
  return Math.round(publishedUnitPriceMinor * 0.9);
}
