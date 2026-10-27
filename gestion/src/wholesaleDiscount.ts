/** Descuento por pedido mayorista: el mismo porcentaje se guarda en todas las líneas del pedido. */
export const roundMoney = (value: number) => Math.round(value * 100) / 100;

/** Importe con el descuento aplicado (porcentaje entre 0 y 100). */
export const applyDiscount = (amount: number, percent: number) => roundMoney(amount * (1 - percent / 100));

export const parseDiscountPercent = (value: string | number) => {
  const percent = Number(value);
  return Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
};

export const formatPercent = (percent: number) => `${new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 }).format(percent)}%`;

/** Porcentaje del pedido: el de sus líneas (todas comparten el mismo); 0 si no tiene descuento. */
export const orderDiscountPercent = (lines: { discount_percent?: number | null }[]) =>
  Math.max(0, ...lines.map((line) => Number(line.discount_percent) || 0));

/** Subtotal (a precio de lista), descuento y total de un pedido. */
export function discountSummary(rows: { gross: number; net: number }[]) {
  const subtotal = roundMoney(rows.reduce((sum, row) => sum + row.gross, 0));
  const total = roundMoney(rows.reduce((sum, row) => sum + row.net, 0));
  return { subtotal, total, discount: roundMoney(Math.max(0, subtotal - total)) };
}
