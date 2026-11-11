import { commerceSource } from "./commerceSource";
import type { CustomerAccountAllocation, CustomerAccountReceipt } from "./data";

type ReceiptRow = {
  id: string; contact_id: string; amount_minor: number; source_amount_minor: number;
  currency: "UYU" | "ARS"; payment_method: string; paid_on: string; note: string | null; consignment_id: string | null;
};
type AllocationRow = {
  id: string; receipt_id: string; order_id: string; amount_minor: number; source_amount_minor: number | null; allocated_at: string;
};

async function readPages<T>(table: string, columns: string): Promise<T[]> {
  if (!commerceSource) throw new Error("No está configurada la conexión con Supabase.");
  const rows: T[] = [];
  for (let start = 0; ; start += 100) {
    const { data, count, error } = await commerceSource.from(table)
      .select(columns, { count: "exact" }).order("id").range(start, start + 99);
    if (error) throw error;
    rows.push(...(data || []) as T[]);
    if (rows.length >= (count ?? rows.length)) return rows;
    if (!data?.length) throw new Error(`La lectura de ${table} quedó incompleta.`);
  }
}

export async function readCustomerAccounts(): Promise<{
  receipts: CustomerAccountReceipt[];
  allocations: CustomerAccountAllocation[];
}> {
  const [receipts, allocations] = await Promise.all([
    readPages<ReceiptRow>("customer_account_receipts", "id,contact_id,amount_minor,source_amount_minor,currency,payment_method,paid_on,note,consignment_id"),
    readPages<AllocationRow>("customer_account_allocations", "id,receipt_id,order_id,amount_minor,source_amount_minor,allocated_at"),
  ]);
  return {
    receipts: receipts.map((row) => ({ id: row.id, contactId: row.contact_id, consignmentId: row.consignment_id, amountMinor: Number(row.amount_minor),
      sourceAmountMinor: Number(row.source_amount_minor), currency: row.currency, paymentMethod: row.payment_method,
      paidOn: row.paid_on, note: row.note })),
    allocations: allocations.map((row) => ({ id: row.id, receiptId: row.receipt_id, orderId: row.order_id,
      amountMinor: Number(row.amount_minor), sourceAmountMinor: row.source_amount_minor == null ? undefined : Number(row.source_amount_minor), allocatedAt: row.allocated_at })),
  };
}
