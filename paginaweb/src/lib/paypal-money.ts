export function paypalUsdMinor(amount: { currency_code?: unknown; value?: unknown } | undefined): number {
  if (amount?.currency_code !== "USD" || typeof amount.value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(amount.value)) {
    throw new Error("PayPal devolvió un importe o moneda inválidos.");
  }
  const [whole, cents = ""] = amount.value.split(".");
  const minor = Number(whole) * 100 + Number(cents.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error("Importe PayPal inválido.");
  return minor;
}
