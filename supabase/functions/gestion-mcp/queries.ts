export type QueryError = { code?: string; message?: string };
export type QueryResult<T> = { data: T[] | null; count: number | null; error: QueryError | null; status?: number };
export const pageNumber = (page: number) => Math.max(1, page);

export function queryErrorMessage(error: QueryError) {
  if (error.code === "42501") return "La cuenta no tiene permiso para consultar esta fuente.";
  if (["PGRST301", "PGRST302", "PGRST303"].includes(error.code ?? "")) return "La sesión no es válida. Volvé a conectar Gestión.";
  if (["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? "")) return "La fuente necesita una actualización del conector. No es un error de permisos.";
  return "No se pudo completar la consulta. Reintentá; si persiste, revisá el conector.";
}

// A new query per call avoids retaining an old Range header on retry.
export async function readPage<T>(fetchRange: (start: number, end: number) => PromiseLike<QueryResult<T>>, page: number, limit: number) {
  const start = (pageNumber(page) - 1) * limit;
  const response = await fetchRange(start, start + limit - 1);
  if (response.status !== 416 && response.error?.code !== "PGRST103") return { ...response, outOfRange: false };
  const first = await fetchRange(0, 0);
  if (first.error) return { ...first, outOfRange: false };
  return { ...first, data: [] as T[], outOfRange: true };
}

export async function readAll<T>(fetchRange: (start: number, end: number) => PromiseLike<QueryResult<T>>, maxRows = 10_000): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  let expected: number | null = null;
  for (let start = 0; start < maxRows; start += size) {
    const response = await fetchRange(start, Math.min(start + size, maxRows) - 1);
    if (response.error) throw new Error(queryErrorMessage(response.error));
    if (response.count == null) throw new Error("No se pudo verificar el total de registros; no se calculará un resumen parcial.");
    if (response.count > maxRows) throw new Error("Hay demasiados registros. Consultá un período más corto o un solo canal.");
    if (expected !== null && response.count !== expected) throw new Error("Los datos cambiaron durante la consulta. Volvé a consultar el resumen.");
    expected = response.count;
    rows.push(...(response.data ?? []));
    if (rows.length === expected) return rows;
    if (!response.data?.length) break;
  }
  throw new Error("La consulta quedó incompleta; no se calculará un resumen parcial.");
}

export type LocalSale = { id: string; channel: string; currency: string; total_minor: number; deposit_minor: number | null; payment_method: string };
export type LocalItem = { sale_id: string; line_total_minor: number };
export type LocalReceipt = { sale_id: string; amount_minor: number };

function money(value: number) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error("Hay un importe inválido; no se calculará un resumen incompleto.");
  return amount;
}

// Same sale/deposit semantics as Gestión's commerceAdapter. total_minor is the
// initial collection for internal sales; deposit_minor is NOT another receipt.
export function summarizeLocalSales(sales: LocalSale[], items: LocalItem[], receipts: LocalReceipt[]) {
  const itemTotals = new Map<string, number>();
  const receiptTotals = new Map<string, number>();
  for (const row of items) itemTotals.set(row.sale_id, money((itemTotals.get(row.sale_id) ?? 0) + money(row.line_total_minor)));
  for (const row of receipts) receiptTotals.set(row.sale_id, money((receiptTotals.get(row.sale_id) ?? 0) + money(row.amount_minor)));
  type Group = { canal: string; moneda: string; ventas: number; vendido_minor: number; cobro_inicial_minor: number; cobros_posteriores_minor: number; cobrado_minor: number; saldo_pendiente_minor: number; excedente_cobrado_minor: number; ventas_con_saldo: number };
  const groups = new Map<string, Group>();
  for (const sale of sales) {
    const key = `${sale.channel}:${sale.currency}`;
    const group = groups.get(key) ?? { canal: sale.channel, moneda: sale.currency, ventas: 0, vendido_minor: 0, cobro_inicial_minor: 0, cobros_posteriores_minor: 0, cobrado_minor: 0, saldo_pendiente_minor: 0, excedente_cobrado_minor: 0, ventas_con_saldo: 0 };
    const initial = money(sale.total_minor);
    const sold = sale.deposit_minor != null || sale.payment_method === "Seña" ? Math.max(initial, itemTotals.get(sale.id) ?? 0) : initial;
    const later = receiptTotals.get(sale.id) ?? 0;
    const balance = sold - initial - later;
    group.ventas++;
    group.vendido_minor = money(group.vendido_minor + sold);
    group.cobro_inicial_minor = money(group.cobro_inicial_minor + initial);
    group.cobros_posteriores_minor = money(group.cobros_posteriores_minor + later);
    group.cobrado_minor = money(group.cobrado_minor + initial + later);
    group.saldo_pendiente_minor = money(group.saldo_pendiente_minor + Math.max(0, balance));
    group.excedente_cobrado_minor = money(group.excedente_cobrado_minor + Math.max(0, -balance));
    if (balance > 0) group.ventas_con_saldo++;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.canal.localeCompare(b.canal) || a.moneda.localeCompare(b.moneda));
}
