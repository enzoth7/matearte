import { supabase } from "./supabaseClient";

export type RetailSource = "Web" | "Local";
export type RetailProductionStatus = "pending" | "in_production" | "completed";

export const RETAIL_PRODUCTION_STATUS_LABELS: Record<RetailProductionStatus, string> = {
  pending: "Pendiente",
  in_production: "En producción",
  completed: "Completado",
};

export interface RetailProductionItem {
  id: string;
  sourceItemId: string;
  source: RetailSource;
  reference: string;
  createdAt: string;
  customer: string;
  product: string;
  quantity: number;
  status: RetailProductionStatus;
}

type WebOrderRow = {
  id: string;
  order_number: number;
  status: string;
  created_at: string;
  customer_snapshot: Record<string, unknown> | null;
  order_items: Array<{
    id: string;
    title: string;
    quantity: number;
    production_status: RetailProductionStatus;
  }>;
};

type LocalSaleRow = {
  id: string;
  sale_number: number;
  customer_name: string;
  sold_on: string;
  created_at: string;
  local_sale_items: Array<{
    id: string;
    product_name: string;
    variant_name: string;
    quantity: number;
    production_status: RetailProductionStatus;
  }>;
};

const cleanText = (value: unknown) => typeof value === "string" ? value.trim() : "";

const webCustomerName = (snapshot: Record<string, unknown> | null) => {
  if (!snapshot) return "Cliente web";
  const direct = cleanText(snapshot.fullName) || cleanText(snapshot.name);
  if (direct) return direct;
  const joined = [cleanText(snapshot.firstName), cleanText(snapshot.lastName)].filter(Boolean).join(" ");
  return joined || cleanText(snapshot.email) || "Cliente web";
};

export function mapRetailProduction(webOrders: WebOrderRow[], localSales: LocalSaleRow[]): RetailProductionItem[] {
  const webItems = webOrders.flatMap((order) => order.order_items.map((item) => ({
    id: `web-${item.id}`,
    sourceItemId: item.id,
    source: "Web" as const,
    reference: `#${order.order_number}`,
    createdAt: order.created_at,
    customer: webCustomerName(order.customer_snapshot),
    product: cleanText(item.title) || "Producto sin detalle",
    quantity: Math.max(1, Number(item.quantity) || 1),
    status: item.production_status || "pending",
  })));

  const localItems = localSales.flatMap((sale) => sale.local_sale_items.map((item) => ({
    id: `local-${item.id}`,
    sourceItemId: item.id,
    source: "Local" as const,
    reference: `#${String(sale.sale_number).padStart(5, "0")}`,
    createdAt: sale.created_at || `${sale.sold_on}T12:00:00`,
    customer: cleanText(sale.customer_name) || "Cliente sin registrar",
    product: [cleanText(item.product_name), cleanText(item.variant_name)].filter(Boolean).join(" · ") || "Producto sin detalle",
    quantity: Math.max(1, Number(item.quantity) || 1),
    status: item.production_status || "pending",
  })));

  return [...webItems, ...localItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchRetailProduction(): Promise<RetailProductionItem[]> {
  if (!supabase) throw new Error("Supabase no está configurado.");

  const [webRequest, localRequest] = await Promise.all([
    supabase
      .from("orders")
      .select("id,order_number,status,created_at,customer_snapshot,order_items(id,title,quantity,production_status)")
      .in("status", ["paid_pending_review", "ready_for_production", "ready_for_fulfillment", "manual_review"])
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("local_sales")
      .select("id,sale_number,customer_name,sold_on,created_at,local_sale_items(id,product_name,variant_name,quantity,production_status)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (webRequest.error) throw new Error(`No se pudieron cargar los pedidos web: ${webRequest.error.message}`);
  if (localRequest.error) throw new Error(`No se pudieron cargar las ventas del local: ${localRequest.error.message}`);

  return mapRetailProduction(
    (webRequest.data || []) as WebOrderRow[],
    (localRequest.data || []) as LocalSaleRow[],
  );
}

export async function updateRetailProductionStatus(
  item: Pick<RetailProductionItem, "source" | "sourceItemId">,
  status: RetailProductionStatus,
) {
  if (!supabase) throw new Error("Supabase no está configurado.");

  const table = item.source === "Web" ? "order_items" : "local_sale_items";
  const { data, error } = await supabase
    .from(table)
    .update({ production_status: status })
    .eq("id", item.sourceItemId)
    .select("id,production_status")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No se pudo guardar el estado.");
  }

  return status;
}
