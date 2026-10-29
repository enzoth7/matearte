export type ArgentinaSettings = { enabled: boolean; ars_per_uyu: number; bank_name: string; account_holder: string; cbu: string; alias: string };
export const argentinaShippingNotice = "Envío dentro de Argentina a cargo del destinatario. No incluido en el total.";
// Finance stores UYU per ARS; checkout uses the reciprocal, frozen per order.
export function arsPerUyuFromFinanceRate(rate: unknown): number {
  const value = Number(rate);
  return Number.isFinite(value) && value > 0 ? Math.round((1 / value) * 1_000_000) / 1_000_000 : 0;
}
export function argentinaReady(value: ArgentinaSettings | null): value is ArgentinaSettings {
  return Boolean(value?.enabled && Number.isFinite(Number(value.ars_per_uyu)) && Number(value.ars_per_uyu) > 0 && value.bank_name.trim() && value.account_holder.trim() && /^\d{22}$/.test(value.cbu) && value.alias.trim());
}
export function toArsMinor(uyuMinor: number, arsPerUyu: number) {
  if (!Number.isSafeInteger(uyuMinor) || uyuMinor < 0 || !Number.isFinite(arsPerUyu) || arsPerUyu <= 0) throw new Error("Cotización o importe inválido.");
  // Match Postgres numeric rounding to the nearest ARS 50 (ties round up).
  const scaledRate = Math.round(arsPerUyu * 1_000_000);
  if (!Number.isSafeInteger(scaledRate) || scaledRate < 1) throw new Error("Cotización fuera de rango.");
  const numerator = BigInt(uyuMinor) * BigInt(scaledRate);
  const amount = Number((numerator + BigInt(2_500_000_000)) / BigInt(5_000_000_000)) * 5000;
  if (!Number.isSafeInteger(amount)) throw new Error("Importe fuera de rango.");
  return amount;
}
