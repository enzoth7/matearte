import { commerceSource } from "./commerceSource";
import type { WholesaleConsignment, WholesaleConsignmentAllocation, WholesaleConsignmentLine, WholesaleConsignmentMovement } from "./data";

const client = () => {
  if (!commerceSource) throw new Error("No está configurada la conexión con Supabase.");
  return commerceSource;
};

async function pages<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 100) {
    const { data, count, error } = await client().from(table).select(columns, { count: "exact" }).order("id").range(start, start + 99);
    if (error) throw error;
    rows.push(...(data || []) as T[]);
    if (rows.length >= (count ?? rows.length)) return rows;
    if (!data?.length) throw new Error(`La lectura de ${table} quedó incompleta.`);
  }
}

type ConsignmentRow = { id: string; order_id: string; contact_id: string; exchange_rate: number; created_at: string };
type LineRow = { id: string; consignment_id: string; order_item_id: string; variant_id: string; sku: string; title: string; quantity: number; unit_price_arg_minor: number };
type MovementRow = { id: string; line_id: string; kind: WholesaleConsignmentMovement["kind"]; quantity: number; occurred_on: string; carrier: string | null; tracking: string | null; note: string | null; created_at: string };
type AllocationRow = { id: string; consignment_id: string; receipt_id: string; source_amount_minor: number; allocated_at: string };

export async function readConsignments(): Promise<{
  consignments: WholesaleConsignment[]; consignmentLines: WholesaleConsignmentLine[];
  consignmentMovements: WholesaleConsignmentMovement[]; consignmentAllocations: WholesaleConsignmentAllocation[];
}> {
  const [headers, lines, movements, allocations] = await Promise.all([
    pages<ConsignmentRow>("wholesale_consignments", "id,order_id,contact_id,exchange_rate,created_at"),
    pages<LineRow>("wholesale_consignment_lines", "id,consignment_id,order_item_id,variant_id,sku,title,quantity,unit_price_arg_minor"),
    pages<MovementRow>("wholesale_consignment_movements", "id,line_id,kind,quantity,occurred_on,carrier,tracking,note,created_at"),
    pages<AllocationRow>("wholesale_consignment_allocations", "id,consignment_id,receipt_id,source_amount_minor,allocated_at"),
  ]);
  return {
    consignments: headers.map((row) => ({ id: row.id, orderId: row.order_id, contactId: row.contact_id,
      exchangeRate: Number(row.exchange_rate), createdAt: row.created_at })),
    consignmentLines: lines.map((row) => ({ id: row.id, consignmentId: row.consignment_id,
      orderItemId: row.order_item_id, variantId: row.variant_id, sku: row.sku, title: row.title,
      quantity: Number(row.quantity), unitPriceArgMinor: Number(row.unit_price_arg_minor) })),
    consignmentMovements: movements.map((row) => ({ id: row.id, lineId: row.line_id, kind: row.kind,
      quantity: Number(row.quantity), occurredOn: row.occurred_on, carrier: row.carrier,
      tracking: row.tracking, note: row.note, createdAt: row.created_at })),
    consignmentAllocations: allocations.map((row) => ({ id: row.id, consignmentId: row.consignment_id,
      receiptId: row.receipt_id, sourceAmountMinor: Number(row.source_amount_minor), allocatedAt: row.allocated_at })),
  };
}

export async function createConsignment(id: string, contactId: string, items: { variantId: string; quantity: number; unitPriceArgMinor: number }[]) {
  const { data, error } = await client().rpc("gestion_create_wholesale_consignment", {
    p_id: id, p_contact_id: contactId, p_items: items.map((item) => ({ variant_id: item.variantId,
      quantity: item.quantity, unit_price_arg_minor: item.unitPriceArgMinor })),
  });
  if (error) throw error;
  return data as { id: string; order_id: string; reference_code: string };
}

export async function recordConsignmentMovement(input: {
  id: string; lineId: string; kind: WholesaleConsignmentMovement["kind"];
  quantity: number; occurredOn: string; carrier?: string; tracking?: string; note?: string;
}) {
  const { error } = await client().rpc("gestion_record_wholesale_consignment_movement", {
    p_id: input.id, p_line_id: input.lineId, p_kind: input.kind, p_quantity: input.quantity,
    p_occurred_on: input.occurredOn, p_carrier: input.carrier || null,
    p_tracking: input.tracking || null, p_note: input.note || null,
  });
  if (error) throw error;
}

export async function recordConsignmentPayment(input: {
  receiptId: string; allocationId: string; consignmentId: string; amountMinor: number;
  exchangeRate: number; method: string; paidOn: string; note?: string;
}) {
  const { error } = await client().rpc("gestion_record_wholesale_consignment_payment", {
    p_receipt_id: input.receiptId, p_allocation_id: input.allocationId,
    p_consignment_id: input.consignmentId, p_source_amount_minor: input.amountMinor,
    p_uyu_per_ars: input.exchangeRate, p_payment_method: input.method,
    p_paid_on: input.paidOn, p_note: input.note || null,
  });
  if (error) throw error;
}

export async function allocateConsignmentReceipt(input: {
  id: string; receiptId: string; consignmentId: string; amountMinor: number;
}) {
  const { error } = await client().rpc("gestion_allocate_wholesale_consignment_receipt", {
    p_id: input.id, p_receipt_id: input.receiptId, p_consignment_id: input.consignmentId,
    p_source_amount_minor: input.amountMinor,
  });
  if (error) throw error;
}
