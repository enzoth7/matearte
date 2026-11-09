export type ExpenseInput = {
  clave_movimiento: string;
  fecha: string;
  descripcion: string;
  categoria: string;
  importe: string;
  moneda: "UYU" | "USD" | "ARS";
  cotizacion_uyu?: number;
  estado: "pagada" | "pendiente";
  proveedor?: string;
  medio_pago?: string;
  fecha_pago?: string;
  notas?: string;
};

export function amountMinor(value: string): number {
  if (!/^(?:0|[1-9]\d{0,9})(?:[.,]\d{1,2})?$/.test(value)) throw new Error("El importe debe ser positivo, con hasta dos decimales y sin separadores de miles.");
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (minor <= 0 || !Number.isSafeInteger(minor)) throw new Error("El importe debe ser mayor que cero.");
  return minor;
}

export function nonNegativeMinor(value: string): number {
  if (!/^(?:0|[1-9]\d{0,9})(?:[.,]\d{1,2})?$/.test(value))
    throw new Error("El importe debe ser no negativo, con hasta dos decimales y sin separadores de miles.");
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) throw new Error("El importe es demasiado grande.");
  return minor;
}

export function expenseRow(input: ExpenseInput, id: string) {
  if (input.estado === "pendiente" && input.fecha_pago) throw new Error("Un gasto pendiente no puede tener fecha de pago.");
  if (input.fecha_pago && input.fecha_pago < input.fecha) throw new Error("La fecha de pago no puede ser anterior a la fecha del gasto.");
  if (input.moneda !== "UYU" && (!Number.isFinite(input.cotizacion_uyu) || !(input.cotizacion_uyu! > 0)))
    throw new Error("Los egresos en ARS o USD necesitan una cotización UYU positiva.");
  return {
    id,
    purchased_on: input.fecha,
    description: input.descripcion.trim(),
    category: input.categoria,
    amount_minor: amountMinor(input.importe),
    currency: input.moneda,
    exchange_rate_to_uyu: input.moneda === "UYU" ? null : input.cotizacion_uyu!,
    status: input.estado,
    paid_on: input.estado === "pagada" ? input.fecha_pago ?? input.fecha : null,
    supplier: input.proveedor?.trim() || null,
    payment_method: input.medio_pago?.trim() || null,
    notes: input.notas?.trim() || null,
  };
}

export async function expenseId(userId: string, key: string): Promise<string> {
  const data = new TextEncoder().encode(`matearte-gestion-mcp-expense-v1:${userId}:${key}`);
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", data)).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80; // Name-derived UUID, version 8.
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function sameExpense(a: ReturnType<typeof expenseRow>, b: ReturnType<typeof expenseRow>): boolean {
  return a.purchased_on === b.purchased_on && a.description === b.description &&
    a.category === b.category && a.amount_minor === b.amount_minor && a.currency === b.currency &&
    a.exchange_rate_to_uyu === b.exchange_rate_to_uyu && a.status === b.status && a.paid_on === b.paid_on && a.supplier === b.supplier &&
    a.payment_method === b.payment_method && a.notes === b.notes;
}
