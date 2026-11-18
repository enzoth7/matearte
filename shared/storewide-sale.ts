/**
 * Descuento general de la tienda (precio tachado en la web).
 *
 * La regla se calcula igual en la base de datos (public.storewide_sale_price), en el servidor web y en el
 * navegador: el precio rebajado se redondea al peso entero. No se acumula con la transferencia, el
 * mayorista ni los códigos: siempre rige el precio más bajo para el cliente.
 */
export type StorewideSaleSettings = {
  storewide_sale_enabled: boolean;
  storewide_sale_percent: number;
  storewide_sale_valid_from: string | null;
  storewide_sale_valid_until: string | null;
};

export const STOREWIDE_SALE_COLUMNS = "storewide_sale_enabled,storewide_sale_percent,storewide_sale_valid_from,storewide_sale_valid_until";

export const DEFAULT_STOREWIDE_SALE: StorewideSaleSettings = {
  storewide_sale_enabled: false,
  storewide_sale_percent: 20,
  storewide_sale_valid_from: null,
  storewide_sale_valid_until: null,
};

export type StorewideSaleState = "off" | "scheduled" | "active" | "expired";

export function montevideoToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function readStorewideSale(value: Partial<StorewideSaleSettings> | null | undefined): StorewideSaleSettings {
  const percent = Number(value?.storewide_sale_percent);
  return {
    storewide_sale_enabled: Boolean(value?.storewide_sale_enabled),
    storewide_sale_percent: Number.isFinite(percent) && percent > 0 && percent < 100 ? percent : DEFAULT_STOREWIDE_SALE.storewide_sale_percent,
    storewide_sale_valid_from: value?.storewide_sale_valid_from || null,
    storewide_sale_valid_until: value?.storewide_sale_valid_until || null,
  };
}

export function storewideSaleState(value: Partial<StorewideSaleSettings> | null | undefined, today = montevideoToday()): StorewideSaleState {
  const sale = readStorewideSale(value);
  if (!sale.storewide_sale_enabled) return "off";
  if (sale.storewide_sale_valid_from && today < sale.storewide_sale_valid_from) return "scheduled";
  if (sale.storewide_sale_valid_until && today > sale.storewide_sale_valid_until) return "expired";
  return "active";
}

/** Porcentaje vigente hoy; 0 si el descuento está apagado, programado o vencido. */
export function activeStorewideSalePercent(value: Partial<StorewideSaleSettings> | null | undefined, today = montevideoToday()): number {
  return storewideSaleState(value, today) === "active" ? readStorewideSale(value).storewide_sale_percent : 0;
}

/** Precio con descuento en centésimos, redondeado al peso entero (igual que public.storewide_sale_price). */
export function salePriceMinor(priceMinor: number, percent: number): number {
  if (!Number.isFinite(priceMinor) || !Number.isFinite(percent) || percent <= 0) return priceMinor;
  const hundredthsOfPercent = Math.round(percent * 100);
  const discounted = Math.round((priceMinor * (10_000 - hundredthsOfPercent)) / 1_000_000) * 100;
  return Math.min(priceMinor, Math.max(0, discounted));
}

/** Total de una línea con el descuento más bajo entre dos precios: nunca se acumulan. */
export function lowestPriceMinor(...prices: Array<number | null | undefined>): number {
  const valid = prices.filter((price): price is number => typeof price === "number" && Number.isFinite(price));
  return valid.length ? Math.min(...valid) : 0;
}

/** El código solo se usa si descuenta más que el descuento general; en un empate rige el general. */
export function couponBeatsSale(couponDiscountMinor: number, saleSavingsMinor: number): boolean {
  return couponDiscountMinor > saleSavingsMinor;
}

export type SaleComparisonLine = { itemType: string; category?: string | null; quantity: number; listUnitMinor: number; saleUnitMinor: number };

export function saleSavingsMinor(lines: SaleComparisonLine[]): number {
  return lines.reduce((sum, line) => sum + Math.max(0, line.listUnitMinor - line.saleUnitMinor) * line.quantity, 0);
}
