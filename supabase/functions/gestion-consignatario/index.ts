import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.112.4";
import { hasOAuthClient } from "../../../shared/supabase-oauth-session.ts";

const allowedOrigins = new Set([
  "https://matearte-gestion.vercel.app",
  "http://127.0.0.1:5180", "http://127.0.0.1:5181",
  "http://localhost:5180", "http://localhost:5181",
  ...(Deno.env.get("GESTION_ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean),
]);
const headers = (origin: string) => ({ "Content-Type": "application/json", "Cache-Control": "no-store",
  ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" } : {}) });
const json = (body: unknown, status: number, origin: string) => new Response(JSON.stringify(body), { status, headers: headers(origin) });

type Consignment = { id: string; order_id: string; currency: "UYU" | "ARS"; created_at: string };
type Line = { id: string; consignment_id: string; sku: string; title: string; quantity: number; unit_price_minor: number };
type Movement = { id: string; line_id: string; kind: "dispatch" | "return" | "kept"; quantity: number; occurred_on: string; created_at: string };
type Allocation = { id: string; consignment_id: string; receipt_id: string; source_amount_minor: number; allocated_at: string };
type Receipt = { id: string; consignment_id: string | null; source_amount_minor: number; currency: "UYU" | "ARS"; payment_method: string; paid_on: string };
type OrdinaryAllocation = { receipt_id: string; amount_minor: number; source_amount_minor: number | null };

async function readRows<T>(service: SupabaseClient, table: string, columns: string,
  filter: (query: any) => any): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await filter(service.from(table).select(columns).order("id")).range(start, start + 499);
    if (error) throw error;
    rows.push(...(data || []) as T[]);
    if ((data || []).length < 500) return rows;
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") return allowedOrigins.has(origin)
    ? new Response(null, { status: 204, headers: headers(origin) }) : new Response(null, { status: 403 });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origen no permitido." }, 403, origin);
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer || hasOAuthClient(bearer)) return json({ error: "Sesión no autorizada." }, 401, origin);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await userClient.auth.getUser(bearer);
  if (authError || !user) return json({ error: "Sesión inválida." }, 401, origin);
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: membership, error: memberError } = await service.from("consignment_portal_users")
    .select("contact_id,display_name,active").eq("user_id", user.id).maybeSingle();
  if (memberError) return json({ error: "No se pudo comprobar el acceso." }, 500, origin);
  if (!membership?.active) return json({ error: "La cuenta no está habilitada." }, 403, origin);

  try {
    const consignments = await readRows<Consignment>(service, "wholesale_consignments", "id,order_id,currency,created_at",
      (query) => query.eq("contact_id", membership.contact_id));
    const ids = consignments.map((row) => row.id);
    if (!ids.length) return json({ name: membership.display_name, consignments: [] }, 200, origin);
    const [lines, allocations, taggedReceipts, orderRows] = await Promise.all([
      readRows<Line>(service, "wholesale_consignment_lines", "id,consignment_id,sku,title,quantity,unit_price_minor", (query) => query.in("consignment_id", ids)),
      readRows<Allocation>(service, "wholesale_consignment_allocations", "id,consignment_id,receipt_id,source_amount_minor,allocated_at", (query) => query.in("consignment_id", ids)),
      readRows<Receipt>(service, "customer_account_receipts", "id,consignment_id,source_amount_minor,currency,payment_method,paid_on", (query) => query.in("consignment_id", ids)),
      readRows<{ id: string; reference_code: string | null }>(service, "orders", "id,reference_code", (query) => query.in("id", consignments.map((row) => row.order_id))),
    ]);
    const lineIds = lines.map((row) => row.id);
    const receiptIds = [...new Set([...allocations.map((row) => row.receipt_id), ...taggedReceipts.map((row) => row.id)])];
    const [movements, receiptRows, ordinaryAllocations] = await Promise.all([
      lineIds.length ? readRows<Movement>(service, "wholesale_consignment_movements", "id,line_id,kind,quantity,occurred_on,created_at", (query) => query.in("line_id", lineIds)) : [],
      receiptIds.length ? readRows<Receipt>(service, "customer_account_receipts", "id,consignment_id,source_amount_minor,currency,payment_method,paid_on", (query) => query.in("id", receiptIds).eq("contact_id", membership.contact_id)) : [],
      receiptIds.length ? readRows<OrdinaryAllocation>(service, "customer_account_allocations", "id,receipt_id,amount_minor,source_amount_minor", (query) => query.in("receipt_id", receiptIds)) : [],
    ]);
    const receipts = new Map(receiptRows.map((row) => [row.id, row]));
    const references = new Map(orderRows.map((row) => [row.id, row.reference_code]));
    const result = consignments.map((consignment) => {
      const consignmentLines = lines.filter((row) => row.consignment_id === consignment.id).map((line) => {
        const ownMovements = movements.filter((row) => row.line_id === line.id);
        const count = (kind: Movement["kind"]) => ownMovements.filter((row) => row.kind === kind)
          .reduce((sum, row) => sum + Number(row.quantity), 0);
        const dispatched = count("dispatch");
        const returned = count("return");
        const kept = count("kept");
        return { id: line.id, sku: line.sku, title: line.title, quantity: Number(line.quantity),
          unitPriceMinor: Number(line.unit_price_minor), dispatched, returned, kept,
          held: dispatched - returned - kept };
      });
      const ownAllocations = allocations.filter((row) => row.consignment_id === consignment.id);
      const ownReceipts = receiptRows.filter((row) => row.consignment_id === consignment.id);
      const sum = (value: (line: typeof consignmentLines[number]) => number) => consignmentLines.reduce((total, line) => total + value(line), 0);
      const confirmedMinor = sum((line) => line.kept * line.unitPriceMinor);
      const paidMinor = ownAllocations.reduce((total, row) => total + Number(row.source_amount_minor), 0);
      const creditMinor = ownReceipts.reduce((total, receipt) => {
        const ordinary = ordinaryAllocations.filter((row) => row.receipt_id === receipt.id)
          .reduce((value, row) => value + Number(consignment.currency === "ARS" ? row.source_amount_minor || 0 : row.amount_minor), 0);
        const consigned = allocations.filter((row) => row.receipt_id === receipt.id)
          .reduce((value, row) => value + Number(row.source_amount_minor), 0);
        return total + Math.max(0, Number(receipt.source_amount_minor) - ordinary - consigned);
      }, 0);
      const ownLineIds = new Set(consignmentLines.map((line) => line.id));
      const events = [
        ...movements.filter((row) => ownLineIds.has(row.line_id)).map((row) => {
          const line = consignmentLines.find((entry) => entry.id === row.line_id)!;
          return { id: row.id, date: row.occurred_on, kind: row.kind, detail: line.title,
            quantity: Number(row.quantity), amountMinor: row.kind === "kept" ? Number(row.quantity) * line.unitPriceMinor : 0 };
        }),
        ...ownReceipts.map((row) => ({ id: row.id, date: row.paid_on, kind: "receipt", detail: row.payment_method,
          quantity: 0, amountMinor: Number(row.source_amount_minor) })),
        ...ownAllocations.map((row) => ({ id: row.id, date: receipts.get(row.receipt_id)?.paid_on || row.allocated_at.slice(0, 10),
          kind: "allocation", detail: receipts.get(row.receipt_id)?.payment_method || "Pago",
          quantity: 0, amountMinor: Number(row.source_amount_minor) })),
      ].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
      return { id: consignment.id, reference: references.get(consignment.order_id) || "Pedido mayorista",
        currency: consignment.currency, createdAt: consignment.created_at, lines: consignmentLines,
        totals: { dispatched: sum((line) => line.dispatched), held: sum((line) => line.held),
          returned: sum((line) => line.returned), kept: sum((line) => line.kept),
          heldValueMinor: sum((line) => line.held * line.unitPriceMinor), confirmedMinor,
          paidMinor, creditMinor, balanceMinor: Math.max(0, confirmedMinor - paidMinor) }, events };
    });
    return json({ name: membership.display_name, consignments: result }, 200, origin);
  } catch {
    return json({ error: "No se pudo leer la cuenta." }, 500, origin);
  }
});
