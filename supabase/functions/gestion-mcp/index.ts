import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.3.1";
import { pipeline } from "npm:@supabase/middleware@1.0.0";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1.9.2";
import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import { z } from "npm:zod@4.6.7";
import { pageNumber, queryErrorMessage, readAll, readPage, summarizeLocalSales, type LocalSale, type LocalItem, type LocalReceipt } from "./queries.ts";
import { amountMinor, expenseId, expenseRow, nonNegativeMinor, sameExpense } from "./financeWrites.ts";
import { catalogDraft, loadMcpCatalogTaxonomy, productInput, productOptions } from "./catalogWrites.ts";
import { loadMcpBridgeKey, mcpMarketingReads, mcpProofHeader, oauthIdentity, signedMcpRestFetch, signMcpRequest } from "../_shared/gestionMcpBridge.ts";

type Dataset = {
  table: string;
  columns: string;
  key: string;
  order: string;
  search?: string;
  date?: string;
  path: string;
  description: string;
  webOrdersOnly?: boolean;
  parentOrders?: boolean;
  requiredKind?: string;
  richardOnly?: boolean;
};

// Explicit columns keep payment payloads, auth data and other hidden fields out of MCP results.
const datasets = {
  pedidos_web: { table: "orders", columns: "id,order_number,reference_code,status,channel,currency,total_minor,shipping_minor,discount_minor,paid_at,created_at,customer_snapshot,shipping_snapshot,shipping_method,shipping_carrier,tracking_code", key: "id", order: "created_at", search: "customer_name", date: "created_at", path: "/comercial/pedidos", description: "Pedidos web, envíos, estados e importes; excluye canales internos para evitar duplicados.", webOrdersOnly: true },
  articulos_web: { table: "order_items", columns: "id,order_id,title,sku,quantity,unit_price_minor,total_minor,item_type,immutable_snapshot,requires_review,review_status,production_status,completed_at,created_at,orders!inner(channel,reference_code)", key: "id", order: "created_at", search: "title", date: "created_at", path: "/produccion/resumen", description: "Artículos exclusivamente de pedidos web, personalización y producción.", webOrdersOnly: true, parentOrders: true },
  pedidos: { table: "orders", columns: "id,order_number,reference_code,customer_name,status,channel,currency,total_minor,deposit_minor,shipping_minor,discount_minor,paid_at,sold_on,created_at,shipping_method,shipping_carrier,tracking_code,shipped_at,delivered_at", key: "id", order: "created_at", search: "customer_name", date: "created_at", path: "/comercial/pedidos", description: "Pedidos de todos los canales, estado, despacho y entrega. No sumar con pedidos_web: son los mismos pedidos. Para totales locales usar resumir_ventas_locales." },
  produccion: { table: "order_items", columns: "id,order_id,title,sku,quantity,item_type,requires_review,review_status,production_status,completed_at,created_at,orders!inner(reference_code,channel,customer_name,status,shipping_method,shipped_at,delivered_at)", key: "id", order: "created_at", search: "title", date: "created_at", path: "/produccion/resumen", description: "Artículos y estado de producción de todos los canales, con pedido y entrega relacionados.", parentOrders: true },
  reportes_publicidad: { table: "ad_reports", columns: "id,period_start,period_end,platform,currency,campaigns,deposit_minor,deposit_on,previous_balance_minor,notes,created_at", key: "id", order: "period_start", date: "period_start", path: "/marketing/pauta", description: "Reportes de publicidad, campañas, depósitos y saldos; fechas filtran el inicio del período." },
  ventas_locales: { table: "local_sales", columns: "id,sale_number,reference_code,channel,customer_id,customer_name,sold_on,payment_method,total_minor,deposit_minor,currency,retail_shipping_minor,retail_rate_to_uyu,created_at", key: "id", order: "sold_on", search: "customer_name", date: "sold_on", path: "/comercial/pedidos", description: "Ventas de local, feria y redes." },
  articulos_locales: { table: "local_sale_items", columns: "id,sale_id,variant_id,sku,product_name,variant_name,quantity,unit_price_minor,line_total_minor,customization,production_status,production_notes,created_at", key: "id", order: "created_at", search: "product_name", date: "created_at", path: "/produccion/resumen", description: "Artículos vendidos por canales internos y su personalización." },
  cobros_locales: { table: "local_sale_receipts", columns: "id,sale_id,amount_minor,payment_method,paid_on,created_at", key: "id", order: "paid_on", date: "paid_on", path: "/finanzas/por-cobrar", description: "Cobros posteriores de ventas locales; no incluye el cobro inicial registrado en ventas_locales.total_minor." },
  pagos_web: { table: "commerce_payments", columns: "id,order_id,provider,status,amount_minor,currency,approved_at,created_at", key: "id", order: "created_at", date: "created_at", path: "/finanzas/por-cobrar", description: "Pagos de pedidos web, sin datos internos del proveedor." },
  comprobantes_transferencia: { table: "commerce_bank_transfer_receipts", columns: "id,order_id,status,submitted_at", key: "id", order: "submitted_at", date: "submitted_at", path: "/finanzas/por-cobrar", description: "Estado y fecha de comprobantes de transferencia de pedidos web." },
  pedidos_mayoristas: { table: "order_lines", columns: "line_id,order_id,customer,model,variant,quantity,status,created_at,completed_at,unit_price_arg,unit_price_uyu,total_arg,total_uyu,exchange_rate,order_type,sale_channel", key: "line_id", order: "created_at", search: "customer", date: "created_at", path: "/comercial/pedidos", description: "Líneas y montos de pedidos mayoristas." },
  catalogo: { table: "commerce_products", columns: "id,name,editorial_slug,category,category_code,description,sale_mode,published,attributes,peso,updated_at", key: "id", order: "name", search: "name", path: "/productos/catalogo", description: "Productos del catálogo." },
  variantes: { table: "commerce_variants", columns: "id,product_id,sku,name,price_minor,base_price_minor,wholesale_price_arg,currency,active,available_local,available_web,available_wholesale,color,weight_grams,rim_type,leather_type,option_values,updated_at", key: "id", order: "sku", search: "sku", path: "/productos/catalogo", description: "Variantes, precios y disponibilidad." },
  imagenes_catalogo: { table: "commerce_product_images", columns: "id,product_id,variant_id,storage_path,alt_text,sort_order,option_values", key: "id", order: "sort_order", search: "alt_text", path: "/productos/catalogo", description: "Imágenes y asociación a productos o variantes del catálogo." },
  clientes_locales: { table: "local_sales_customers", columns: "id,full_name,company_name,email,phone,address,city,country,department,postal_code,product_interest,birth_date,first_purchase_date,last_purchase_date,notes,origin_channel,customer_type,updated_at", key: "id", order: "full_name", search: "full_name", path: "/clientes/base", description: "Clientes de ventas locales y redes." },
  clientes_mayoristas: { table: "customers", columns: "full_name,company_name,first_name,last_name,email,phone,address,city,country,department,postal_code,notes,origin_channel,customer_type", key: "full_name", order: "full_name", search: "full_name", path: "/clientes/base", description: "Contactos mayoristas." },
  sorteo: { table: "rural_raffle_entries", columns: "id,full_name,company_name,email,phone,address,city,country,department,postal_code,birth_date,product_interest,origin_channel,customer_type,marketing_opt_in,created_at", key: "id", order: "created_at", search: "full_name", date: "created_at", path: "/marketing/sorteo", description: "Inscripciones al sorteo." },
  compras: { table: "purchases", columns: "id,purchased_on,due_on,supplier,description,category,amount_minor,currency,exchange_rate_to_uyu,payment_method,status,paid_on,invoice_number,notes,created_at", key: "id", order: "purchased_on", search: "description", date: "purchased_on", path: "/finanzas/egresos", description: "Egresos variables. Los importes _minor son centésimos en su moneda original." },
  gastos_fijos: { table: "fixed_expenses", columns: "id,name,category,amount_minor,currency,due_day,payment_method,starts_on,ends_on,active,notes,created_at", key: "id", order: "name", search: "name", path: "/finanzas/gastos-fijos", description: "Gastos fijos." },
  pagos_gastos_fijos: { table: "fixed_expense_payments", columns: "id,fixed_expense_id,month,amount_minor,paid_on,exchange_rate_to_uyu,created_at", key: "id", order: "paid_on", date: "paid_on", path: "/finanzas/gastos-fijos", description: "Pagos registrados de gastos fijos y cotización utilizada." },
  categorias_gastos: { table: "expense_categories", columns: "id,name,kind,active", key: "id", order: "name", search: "name", path: "/finanzas/egresos", description: "Categorías de egresos y gastos fijos." },
  categorias_ingresos: { table: "finance_income_categories", columns: "name,active", key: "name", order: "name", search: "name", path: "/finanzas/ingresos", description: "Categorías de ingresos ajenos a ventas." },
  ingresos_extraordinarios: { table: "finance_manual_incomes", columns: "id,received_on,category,description,amount_minor,currency,exchange_rate_to_uyu,created_at", key: "id", order: "received_on", search: "description", date: "received_on", path: "/finanzas/ingresos", description: "Ingresos manuales ajenos a ventas. La cotización de cada movimiento queda guardada." },
  saldos_iniciales: { table: "finance_monthly_openings", columns: "month,amount_minor,updated_at", key: "month", order: "month", date: "month", path: "/finanzas/egresos", description: "Saldos iniciales manuales en UYU, sin contarlos como egresos." },
  ajustes_mensuales: { table: "finance_monthly_adjustments", columns: "month,amount_minor,updated_at", key: "month", order: "month", date: "month", path: "/finanzas/resumen", description: "Ajustes del saldo final por mes en UYU." },
  cuentas_conciliacion: { table: "finance_accounts", columns: "id,name,kind,currency,created_at", key: "id", order: "name", search: "name", path: "/finanzas/conciliacion", description: "Cuentas que se cuentan al cierre." },
  cierres_mensuales: { table: "finance_monthly_closes", columns: "id,month,revision,status,reason,balances,adjustments,rates,opening_balances,summary,created_at,closed_at", key: "id", order: "month", date: "month", path: "/finanzas/conciliacion", description: "Cierres y borradores de conciliación. No sumar revisiones de un mismo mes." },
  contactos_cuentas: { table: "contacts", columns: "id,full_name,wholesale_name,company_name,phone,customer_type", key: "id", order: "full_name", search: "full_name", path: "/finanzas/por-cobrar", description: "Contactos y sus identificadores para asignar cobros a clientes." },
  cobros_cuenta: { table: "customer_account_receipts", columns: "id,contact_id,source_amount_minor,amount_minor,currency,uyu_per_ars,payment_method,paid_on,note,created_at", key: "id", order: "paid_on", date: "paid_on", path: "/finanzas/por-cobrar", description: "Entregas a cuenta: importe original y equivalente UYU; asignarlas no crea un ingreso nuevo." },
  asignaciones_cuenta: { table: "customer_account_allocations", columns: "id,receipt_id,order_id,source_amount_minor,amount_minor,allocated_at", key: "id", order: "allocated_at", path: "/finanzas/por-cobrar", description: "Asignación de cobros ya registrados a pedidos; no volver a contarla como ingreso." },
  cobros_mayoristas: { table: "wholesale_order_receipts", columns: "id,sale_id,source_amount_minor,amount_minor,currency,uyu_per_ars,payment_method,paid_on,created_at", key: "id", order: "paid_on", date: "paid_on", path: "/finanzas/por-cobrar", description: "Cobros directos mayoristas en ARS, con equivalencia UYU guardada." },
  saldos_historicos_mayoristas: { table: "wholesale_order_payment_openings", columns: "sale_id,collected_arg_minor,confirmed_at,paid_in_full_without_price,finance_paid_at_order", key: "sale_id", order: "sale_id", path: "/finanzas/por-cobrar", description: "Conciliación de pagos mayoristas anteriores al registro de cobros." },
  consignaciones: { table: "wholesale_consignments", columns: "id,order_id,contact_id,exchange_rate,created_at", key: "id", order: "created_at", date: "created_at", path: "/finanzas/consignaciones", description: "Acuerdos de consignación vinculados a producción." },
  lineas_consignacion: { table: "wholesale_consignment_lines", columns: "id,consignment_id,order_item_id,variant_id,sku,title,quantity,unit_price_arg_minor", key: "id", order: "id", search: "title", path: "/finanzas/consignaciones", description: "Productos y precios ARS pactados de cada consignación." },
  movimientos_consignacion: { table: "wholesale_consignment_movements", columns: "id,line_id,kind,quantity,occurred_on,carrier,tracking,note,created_at", key: "id", order: "occurred_on", date: "occurred_on", path: "/finanzas/consignaciones", description: "Entregas, devoluciones y unidades conservadas; las conservadas generan deuda." },
  asignaciones_consignacion: { table: "wholesale_consignment_allocations", columns: "id,consignment_id,receipt_id,source_amount_minor,allocated_at", key: "id", order: "allocated_at", path: "/finanzas/consignaciones", description: "Cobros asignados a consignaciones. Ya existen en cobros_cuenta." },
  perfiles_costos: { table: "inventory_cost_profiles", columns: "id,category_code,name,method,benchmark_material_minor", key: "id", order: "category_code", path: "/inventario/insumos", description: "Perfiles de costo por categoría. Solo Richard puede leer importes.", richardOnly: true },
  insumos: { table: "inventory_cost_lines", columns: "id,profile_id,name,group_name,kind,mode,amount_minor,currency,exchange_rate_to_uyu,purchase_quantity,consumption_quantity,unit,sort_order,catalog_variant_id", key: "id", order: "sort_order", search: "name", path: "/inventario/insumos", description: "Insumos y componentes de costo de fabricación. Solo Richard.", richardOnly: true },
  articulos_reventa: { table: "inventory_cost_lines", columns: "id,profile_id,name,kind,amount_minor,currency,exchange_rate_to_uyu,catalog_variant_id", key: "id", order: "name", search: "name", path: "/inventario/reventa", description: "Costos de compra de artículos de reventa. Solo Richard.", requiredKind: "purchase", richardOnly: true },
  productos_fabricados: { table: "inventory_manufactured_products", columns: "id,name,category_code,catalog_product_id,reference_sale_price_minor,reference_variable_cost_minor", key: "id", order: "name", search: "name", path: "/inventario/fabricados", description: "Productos fabricados y precio base de referencia, sin variante. Solo Richard.", richardOnly: true },
  insumos_por_producto: { table: "inventory_manufactured_supplies", columns: "product_id,cost_line_id,quantity", key: "product_id", order: "product_id", path: "/inventario/fabricados", description: "Cantidades de insumos vinculadas a cada producto fabricado. Solo Richard.", richardOnly: true },
  tarifas_nacionales: { table: "shipping_rates", columns: "id,code,name,departments,rate_minor,is_pickup,active,updated_at", key: "id", order: "name", search: "name", path: "/entregas/tarifas", description: "Tarifas de entrega nacionales." },
  tarifas_internacionales: { table: "commerce_international_shipping_rates", columns: "row_order,weight_label,weight_min_g,weight_max_g,argentina,suramerica,estados_unidos,resto_america,espana,resto_europa,resto_mundo", key: "row_order", order: "row_order", path: "/entregas/tarifas", description: "Tarifas de entrega internacionales." },
  cotizaciones: { table: "commerce_exchange_rates", columns: "currency_code,rate_to_uyu,updated_at", key: "currency_code", order: "currency_code", path: "/finanzas/monedas", description: "Cotizaciones usadas por el comercio." },
  cotizacion_mayorista: { table: "settings", columns: "id,exchange_rate", key: "id", order: "id", path: "/finanzas/monedas", description: "Cotización usada para precios mayoristas en pesos." },
  descuentos: { table: "commerce_discounts", columns: "id,code,discount_type,value,valid_from,valid_until,enabled,applicability,category_codes,include_design_items,redemption_limit,welcome_only", key: "id", order: "code", search: "code", path: "/marketing/descuentos", description: "Descuentos, vigencia y alcance por categorías; include_design_items indica Mates Personalizados del personalizador." },
  categorias_catalogo: { table: "commerce_categories", columns: "code,label_es,parent_code,active,sort_order", key: "code", order: "sort_order", search: "label_es", path: "/productos/categorias", description: "Categorías del catálogo." },
  avisos: { table: "site_announcements", columns: "id,image_path,alt_text,valid_from,valid_until,enabled,created_at", key: "id", order: "created_at", date: "created_at", path: "/marketing/avisos", description: "Avisos del sitio." },
  usuarios: { table: "commerce_admin_users", columns: "user_id,display_name,active,access_user_id,allowed_paths", key: "user_id", order: "display_name", search: "display_name", path: "/administracion/usuarios", description: "Usuarios y permisos de Gestión." },
  canales: { table: "commerce_settings", columns: "singleton,commerce_enabled,mercado_pago_enabled,paypal_enabled,catalog_price_adjustment_enabled,catalog_price_adjustment_percent,wholesale_mate_discount_enabled,wholesale_mate_quantity_threshold,wholesale_mate_discount_percent,wholesale_discount_categories,updated_at", key: "singleton", order: "singleton", path: "/administracion/canales", description: "Configuración comercial y medios de pago habilitados." },
  cuentas_transferencia: { table: "commerce_bank_transfer_settings", columns: "singleton,account_holder,transfer_account,cash_deposit_account,cash_deposit_label,updated_at", key: "singleton", order: "singleton", path: "/administracion/canales", description: "Datos de transferencia mostrados en Gestión." },
} satisfies Record<string, Dataset>;

const datasetNames = Object.keys(datasets) as [keyof typeof datasets, ...(keyof typeof datasets)[]];
// Only these exact fields can be filtered; callers cannot choose SQL or columns.
const filters: Partial<Record<keyof typeof datasets, Record<string, string>>> = {
  pedidos: { canal: "channel", estado: "status", referencia: "reference_code" },
  pedidos_web: { estado: "status", referencia: "reference_code" },
  ventas_locales: { canal: "channel", referencia: "reference_code" },
  articulos_web: { pedido_id: "order_id", estado: "production_status", sku: "sku", referencia: "orders.reference_code" },
  produccion: { pedido_id: "order_id", estado: "production_status", canal: "orders.channel", referencia: "orders.reference_code", sku: "sku" },
  articulos_locales: { pedido_id: "sale_id", estado: "production_status", sku: "sku" },
  cobros_locales: { pedido_id: "sale_id" },
  pagos_web: { pedido_id: "order_id", estado: "status" },
  comprobantes_transferencia: { pedido_id: "order_id", estado: "status" },
  pedidos_mayoristas: { pedido_id: "order_id", estado: "status" },
  catalogo: { categoria: "category_code" }, variantes: { sku: "sku" },
  compras: { estado: "status", categoria: "category" },
  ingresos_extraordinarios: { categoria: "category" },
  lineas_consignacion: { consignacion_id: "consignment_id" },
  movimientos_consignacion: { linea_id: "line_id" },
  cobros_cuenta: { cliente_id: "contact_id" },
  cobros_mayoristas: { pedido_id: "sale_id" },
  insumos: { perfil_id: "profile_id" },
  articulos_reventa: { perfil_id: "profile_id" },
  productos_fabricados: { categoria: "category_code" },
  insumos_por_producto: { producto_id: "product_id" },
};
const pageSchema = z.number().int().min(0).max(200).default(1).describe("Primera página: 1. Usar siguiente_pagina para continuar. 0 se acepta como alias de 1.");
const readOnly = { readOnlyHint: true, openWorldHint: false, destructiveHint: false };
const writeTool = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const currencySchema = z.enum(["UYU", "ARS", "USD"]);
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const moneySchema = z.string().describe("Importe sin símbolo ni separadores de miles, con hasta dos decimales.");
const writerId = "5afbc94d-aecf-44e8-b12e-e136f49abb62"; // Richard Ortiz's Gestión account.
const expenseColumns = "id,purchased_on,description,category,amount_minor,currency,exchange_rate_to_uyu,status,paid_on,supplier,payment_method,notes";
const expenseInput = z.object({
  clave_movimiento: z.string().trim().min(8).max(120).describe("Clave estable de esta transacción bancaria o UUID. Reutilizarla al reintentar; no incluir número de cuenta completo."),
  fecha: z.iso.date().describe("Fecha del gasto, AAAA-MM-DD."),
  descripcion: z.string().trim().min(1).max(200),
  categoria: z.string().trim().min(1).max(60).describe("Nombre exacto de una categoría activa de Compras; consultar listar_opciones_gastos antes."),
  importe: z.string().describe("Importe positivo sin símbolo ni separadores de miles; máximo dos decimales, por ejemplo 7982.00."),
  moneda: z.enum(["UYU", "USD", "ARS"]),
  cotizacion_uyu: z.number().positive().optional().describe("UYU por unidad de ARS o USD. Obligatoria para monedas extranjeras; conservar la cotización del movimiento."),
  estado: z.enum(["pagada", "pendiente"]),
  proveedor: z.string().trim().max(120).optional(),
  medio_pago: z.string().trim().max(60).optional(),
  fecha_pago: z.iso.date().optional(),
  notas: z.string().trim().max(1000).optional().describe("Referencia o contexto breve; no guardar números completos de cuenta ni datos sensibles del estado de cuenta."),
});
type ResultContent = { type: "text"; text: string } | { type: "image"; mimeType: string; data: string };
const result = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] as ResultContent[] });
const failure = (value: unknown) => ({ ...result(value), isError: true });
const imageUrl = (supabase: { storage: { from: (bucket: string) => { getPublicUrl: (path: string) => { data: { publicUrl: string } } } } }, path: string) =>
  supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
function encodeImage(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  return btoa(binary);
}
type CatalogImage = { product_id: string; variant_id: string | null; storage_path: string; sort_order: number; option_values: { color?: string } | null };
type CatalogRecord = { id: string; product_id?: string; color?: string | null; option_values?: { color?: string } | null; storage_path?: string };
const catalogColor = (value: unknown) => typeof value === "string" ? value.trim().toLocaleLowerCase("es") : "";

function catalogCover(images: CatalogImage[], variant?: CatalogRecord) {
  const ordered = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const color = catalogColor(variant?.option_values?.color || variant?.color);
  return (variant && ordered.find((image) => image.variant_id === variant.id))
    || (color && ordered.find((image) => !image.variant_id && catalogColor(image.option_values?.color) === color))
    || ordered.find((image) => !image.variant_id && !catalogColor(image.option_values?.color))
    || (!variant ? ordered[0] : undefined);
}

Deno.serve(pipeline(
  [withOAuthProtectedResource(), withSupabase({ auth: "user" })],
  async (request, { supabaseAdmin, jwtClaims }) => {
    const identity = oauthIdentity(jwtClaims);
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!identity || !token) {
      return Response.json({ error: "Conectá MateArte Gestión por OAuth." }, { status: 403 });
    }
    const url = Deno.env.get("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
    const bridgeKey = await loadMcpBridgeKey(supabaseAdmin);
    if (!url || !publishableKey || !bridgeKey) {
      return Response.json({ error: "El acceso del MCP a Gestión no está disponible." }, { status: 503 });
    }
    const supabase = createClient(url, publishableKey, {
      accessToken: async () => token,
      global: { fetch: signedMcpRestFetch(bridgeKey, identity, url) },
    });
    // RLS applies to every query; the membership check is a second, server-side gate.
    const { data: member, error: memberError } = await supabase.from("commerce_admin_users")
      .select("user_id,display_name,active,access_user_id")
      .eq("user_id", identity.sub)
      .eq("active", true)
      .maybeSingle();
    if (memberError || !member || member.access_user_id !== "t1") {
      return Response.json({ error: "Solo las cuentas propietarias de Gestión pueden consultar este MCP." }, { status: 403 });
    }
    const canWrite = identity.sub === writerId;

    const handler = createMcpHandler(() => {
      const server = new McpServer({
        name: "matearte-gestion",
        version: "1.4.0",
      });

      server.registerTool("quien_soy", {
        title: "Cuenta conectada",
        description: "Comprueba qué cuenta de Gestión está conectada y qué operaciones de Finanzas, Inventario y catálogo puede realizar.",
        inputSchema: z.object({}), annotations: readOnly,
      }, async () => result({ nombre: member.display_name, perfil: "propietario", solo_lectura: !canWrite, puede_registrar_gastos: canWrite, puede_registrar_productos: canWrite, puede_gestionar_finanzas: canWrite, puede_gestionar_costos: canWrite }));

      server.registerTool("listar_fuentes", {
        title: "Fuentes disponibles",
        description: "Enumera las fuentes de Gestión que se pueden consultar. Úsala antes de elegir una fuente.",
        inputSchema: z.object({}), annotations: readOnly,
      }, async () => result({ primera_pagina: 1, importes: "Los campos _minor son centésimos; no mezclar monedas ni sumar cobros y asignaciones de los mismos pagos. Para totales de ventas de local/feria/redes usar resumir_ventas_locales.", fuentes: Object.entries(datasets).filter(([, entry]) => canWrite || !(entry as Dataset).richardOnly).map(([name, entry]) => { const dataset: Dataset = entry; return { nombre: name, descripcion: dataset.description, pagina: `https://matearte-gestion.vercel.app${dataset.path}`, campo_busqueda: dataset.search ?? null, campo_fecha: dataset.date ?? null, filtros_exactos: Object.keys(filters[name as keyof typeof datasets] ?? {}) }; }), secciones_sin_registros: ["Inventario: Stock de productos", "Inventario: Movimientos y reservas", "Inventario: Reposición", "Inventario: Proveedores"] }));

        server.registerTool("listar_opciones_gastos", {
          title: "Categorías disponibles para registrar gastos",
          description: "Consulta las categorías activas de Compras antes de preparar gastos. Solo la cuenta de Gestión de Richard puede usarla.",
          inputSchema: z.object({}), annotations: readOnly,
        }, async () => {
          if (!canWrite) return failure({ error: "Solo la cuenta de Gestión de Richard puede registrar gastos por este MCP." });
          const { data, error } = await supabase.from("expense_categories").select("name,kind")
            .eq("active", true).in("kind", ["compra", "ambas"]).order("name");
          return error ? failure({ error: "No se pudieron consultar las categorías." }) : result({ categorias: data ?? [] });
        });

      server.registerTool("agregar_categoria_financiera", {
        title: "Agregar categoría de ingresos o egresos",
        description: "Solo Richard. Crea una categoría nueva disponible en Finanzas. Confirmá el nombre y tipo con Richard antes de guardarla.",
        inputSchema: z.object({ tipo: z.enum(["ingreso", "egreso", "gasto_fijo"]), nombre: z.string().trim().min(1).max(60), confirmado: z.literal(true) }),
        annotations: writeTool,
      }, async ({ tipo, nombre }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede crear categorías financieras." });
        const table = tipo === "ingreso" ? "finance_income_categories" : "expense_categories";
        const { data: existing, error: lookupError } = await supabase.from(table).select("name").ilike("name", nombre).limit(1);
        if (lookupError) return failure({ error: "No se pudo comprobar si ya existe la categoría." });
        if (existing?.length) return result({ estado: "ya_existia", nombre: existing[0].name });
        const { error } = tipo === "ingreso"
          ? await supabase.from("finance_income_categories").insert({ name: nombre })
          : await supabase.from("expense_categories").insert({ name: nombre, kind: tipo === "gasto_fijo" ? "gasto_fijo" : "compra" });
        return error ? failure({ error: "No se pudo crear la categoría.", detalle: error.message })
          : result({ estado: "registrada", nombre, pagina: `https://matearte-gestion.vercel.app/finanzas/${tipo === "ingreso" ? "ingresos" : "egresos"}` });
      });

      server.registerTool("registrar_ingreso", {
        title: "Registrar un ingreso ajeno a ventas",
        description: "Solo Richard. Para ingresos extraordinarios, devoluciones de impuestos u otros ingresos que no provengan de pedidos. Mostrar fecha, concepto, importe, moneda, cotización y categoría, y pedir confirmación antes de guardar. Reutilizar clave_ingreso al reintentar. No registrar cobros de ventas aquí.",
        inputSchema: z.object({ clave_ingreso: z.string().trim().min(8).max(120), fecha: z.iso.date(),
          categoria: z.string().trim().min(1).max(60), concepto: z.string().trim().min(1).max(200),
          importe: moneySchema, moneda: currencySchema, cotizacion_uyu: z.number().positive().optional(),
          confirmado: z.literal(true), permitir_coincidencia: z.boolean().default(false) }),
        annotations: writeTool,
      }, async ({ clave_ingreso, fecha, categoria, concepto, importe, moneda, cotizacion_uyu, permitir_coincidencia }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede registrar ingresos." });
        if (moneda !== "UYU" && (!Number.isFinite(cotizacion_uyu) || !(cotizacion_uyu! > 0)))
          return failure({ error: "Falta la cotización UYU del ingreso." });
        let minor: number;
        try { minor = amountMinor(importe); } catch (error) { return failure({ error: (error as Error).message }); }
        const { data: category, error: categoryError } = await supabase.from("finance_income_categories")
          .select("name").eq("name", categoria).eq("active", true).maybeSingle();
        if (categoryError || !category) return failure({ error: "La categoría de ingresos no existe o no está activa." });
        const id = await expenseId(identity.sub, `income:${clave_ingreso}`);
        const row = { id, received_on: fecha, category: categoria, description: concepto,
          amount_minor: minor, currency: moneda, exchange_rate_to_uyu: moneda === "UYU" ? null : cotizacion_uyu!, created_by: identity.sub };
        const { data: prior, error: priorError } = await supabase.from("finance_manual_incomes")
          .select("id,received_on,category,description,amount_minor,currency,exchange_rate_to_uyu").eq("id", id).maybeSingle();
        if (priorError) return failure({ error: "No se pudo comprobar el reintento." });
        if (prior) return prior.received_on === fecha && prior.category === categoria && prior.description === concepto
          && Number(prior.amount_minor) === minor && prior.currency === moneda
          && Number(prior.exchange_rate_to_uyu || 0) === Number(row.exchange_rate_to_uyu || 0)
          ? result({ estado: "ya_registrado", id }) : failure({ error: "La clave ya fue usada para otro ingreso." });
        const { data: duplicates, error: duplicateError } = await supabase.from("finance_manual_incomes")
          .select("id").eq("received_on", fecha).eq("description", concepto).eq("amount_minor", minor).eq("currency", moneda).limit(1);
        if (duplicateError) return failure({ error: "No se pudo comprobar si el ingreso ya existe." });
        if (duplicates?.length && !permitir_coincidencia) return failure({ error: "Ya hay un ingreso con la misma fecha, concepto, importe y moneda. Confirmá que son distintos.", id_existente: duplicates[0].id });
        const { error } = await supabase.from("finance_manual_incomes").insert(row);
        return error ? failure({ error: "No se pudo registrar el ingreso.", detalle: error.message })
          : result({ estado: "registrado", id, pagina: "https://matearte-gestion.vercel.app/finanzas/ingresos" });
      });

      server.registerTool("guardar_saldo_o_ajuste", {
        title: "Guardar saldo inicial o ajuste mensual",
        description: "Solo Richard. Actualiza el saldo inicial manual o el ajuste del resumen financiero en UYU. Puede reemplazar un valor anterior: mostrar el mes, importe y valor existente, y pedir confirmación específica.",
        inputSchema: z.object({ tipo: z.enum(["saldo_inicial", "ajuste"]), mes: monthSchema,
          importe_uyu: z.string().regex(/^-?(?:0|[1-9]\d{0,9})(?:[.,]\d{1,2})?$/), confirmado: z.literal(true) }),
        annotations: { ...writeTool, idempotentHint: true },
      }, async ({ tipo, mes, importe_uyu }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede cambiar saldos o ajustes." });
        const negative = importe_uyu.startsWith("-");
        let minor: number;
        try { minor = (negative ? -1 : 1) * nonNegativeMinor(importe_uyu.replace(/^-/, "")); }
        catch (error) { return failure({ error: (error as Error).message }); }
        const table = tipo === "saldo_inicial" ? "finance_monthly_openings" : "finance_monthly_adjustments";
        const { data: prior, error: readError } = await supabase.from(table).select("amount_minor").eq("month", `${mes}-01`).maybeSingle();
        if (readError) return failure({ error: "No se pudo consultar el importe actual." });
        if (prior && Number(prior.amount_minor) === minor) return result({ estado: "sin_cambios", mes, importe_uyu });
        const { error } = await supabase.from(table).upsert({ month: `${mes}-01`, amount_minor: minor,
          updated_by: identity.sub, updated_at: new Date().toISOString() }, { onConflict: "month" });
        return error ? failure({ error: "No se pudo guardar el importe.", detalle: error.message })
          : result({ estado: "guardado", mes, anterior_minor: prior?.amount_minor ?? null, nuevo_minor: minor,
            pagina: `https://matearte-gestion.vercel.app/finanzas/${tipo === "saldo_inicial" ? "egresos" : "resumen"}` });
      });

      server.registerTool("registrar_gasto_fijo", {
        title: "Agregar gasto fijo",
        description: "Solo Richard. Crea un gasto fijo en Finanzas. Mostrar concepto, categoría, importe mensual, moneda, vigencia y vencimiento antes de pedir confirmación. Reutilizar clave_gasto_fijo al reintentar.",
        inputSchema: z.object({ clave_gasto_fijo: z.string().trim().min(8).max(120), concepto: z.string().trim().min(1).max(120),
          categoria: z.string().trim().min(1).max(60), importe: moneySchema, moneda: z.enum(["UYU", "USD"]),
          rige_desde: z.iso.date(), rige_hasta: z.iso.date().optional(), dia_vencimiento: z.number().int().min(1).max(31).optional(),
          medio_pago: z.string().trim().max(60).optional(), notas: z.string().trim().max(1000).optional(), confirmado: z.literal(true) }),
        annotations: writeTool,
      }, async ({ clave_gasto_fijo, concepto, categoria, importe, moneda, rige_desde, rige_hasta, dia_vencimiento, medio_pago, notas }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede registrar gastos fijos." });
        if (rige_hasta && rige_hasta < rige_desde) return failure({ error: "La fecha final no puede ser anterior al inicio." });
        let minor: number;
        try { minor = amountMinor(importe); } catch (error) { return failure({ error: (error as Error).message }); }
        const { data: category, error: categoryError } = await supabase.from("expense_categories")
          .select("name").eq("name", categoria).eq("active", true).in("kind", ["gasto_fijo", "ambas"]).maybeSingle();
        if (categoryError || !category) return failure({ error: "La categoría de gasto fijo no existe o no está activa." });
        const id = await expenseId(identity.sub, `fixed:${clave_gasto_fijo}`);
        const row = { id, name: concepto, category: categoria, amount_minor: minor, currency: moneda,
          due_day: dia_vencimiento ?? null, payment_method: medio_pago || null, starts_on: rige_desde,
          ends_on: rige_hasta || null, active: true, notes: notas || null, created_by: identity.sub };
        const { data: prior, error: readError } = await supabase.from("fixed_expenses")
          .select("id,name,category,amount_minor,currency,due_day,payment_method,starts_on,ends_on,active,notes").eq("id", id).maybeSingle();
        if (readError) return failure({ error: "No se pudo comprobar el reintento." });
        if (prior) return prior.name === row.name && prior.category === row.category && Number(prior.amount_minor) === minor
          && prior.currency === moneda && prior.starts_on === rige_desde && prior.ends_on === row.ends_on
          && prior.due_day === row.due_day && prior.payment_method === row.payment_method && prior.notes === row.notes
          ? result({ estado: "ya_registrado", id }) : failure({ error: "La clave ya corresponde a otro gasto fijo o este fue editado." });
        const { error } = await supabase.from("fixed_expenses").insert(row);
        return error ? failure({ error: "No se pudo guardar el gasto fijo.", detalle: error.message })
          : result({ estado: "registrado", id, pagina: "https://matearte-gestion.vercel.app/finanzas/gastos-fijos" });
      });

      server.registerTool("registrar_pago_gasto_fijo", {
        title: "Marcar pago de un gasto fijo",
        description: "Solo Richard. Marca una mensualidad de un gasto fijo como pagada. Confirmar gasto, mes, importe, moneda, fecha y cotización. No crea un segundo egreso variable. Reutilizar clave_pago al reintentar.",
        inputSchema: z.object({ clave_pago: z.string().trim().min(8).max(120), gasto_fijo_id: z.uuid(), mes: monthSchema,
          fecha_pago: z.iso.date(), importe: moneySchema, cotizacion_uyu: z.number().positive().optional(), confirmado: z.literal(true) }),
        annotations: writeTool,
      }, async ({ clave_pago, gasto_fijo_id, mes, fecha_pago, importe, cotizacion_uyu }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede registrar pagos de gastos fijos." });
        let minor: number;
        try { minor = amountMinor(importe); } catch (error) { return failure({ error: (error as Error).message }); }
        const { data: template, error: templateError } = await supabase.from("fixed_expenses")
          .select("id,name,currency,starts_on,ends_on").eq("id", gasto_fijo_id).maybeSingle();
        if (templateError || !template) return failure({ error: "El gasto fijo no existe." });
        if (template.starts_on > `${mes}-31` || template.ends_on && template.ends_on < `${mes}-01`)
          return failure({ error: "El gasto fijo no rige en ese mes." });
        if (template.currency !== "UYU" && (!Number.isFinite(cotizacion_uyu) || !(cotizacion_uyu! > 0)))
          return failure({ error: "Falta la cotización del pago." });
        const id = await expenseId(identity.sub, `fixed-payment:${clave_pago}`);
        const row = { id, fixed_expense_id: gasto_fijo_id, month: `${mes}-01`, paid_on: fecha_pago,
          amount_minor: minor, exchange_rate_to_uyu: template.currency === "UYU" ? 1 : cotizacion_uyu!, created_by: identity.sub };
        const { data: previous, error: previousError } = await supabase.from("fixed_expense_payments")
          .select("id,fixed_expense_id,month,paid_on,amount_minor,exchange_rate_to_uyu").eq("fixed_expense_id", gasto_fijo_id).eq("month", `${mes}-01`).limit(2);
        if (previousError) return failure({ error: "No se pudo revisar el pago existente." });
        if (previous?.length) return previous[0].id === id && previous[0].paid_on === fecha_pago
          && Number(previous[0].amount_minor) === minor && Number(previous[0].exchange_rate_to_uyu) === row.exchange_rate_to_uyu
          ? result({ estado: "ya_registrado", id }) : failure({ error: "Este gasto fijo ya tiene un pago para ese mes.", id_existente: previous[0].id });
        const { error } = await supabase.from("fixed_expense_payments").insert(row);
        return error ? failure({ error: "No se pudo registrar el pago.", detalle: error.message })
          : result({ estado: "registrado", id, moneda: template.currency, pagina: "https://matearte-gestion.vercel.app/finanzas/gastos-fijos" });
      });

      server.registerTool("registrar_cobro_pedido", {
        title: "Registrar cobro de un pedido pendiente",
        description: "Solo Richard. Cobro directo de un pedido local en UYU o mayorista en ARS. Consultar pedido, saldo y cobros previos; mostrar importe, medio, fecha y cotización si es ARS, y pedir confirmación. No usar para consignaciones. Reutilizar clave_cobro al reintentar.",
        inputSchema: z.object({ clave_cobro: z.string().trim().min(8).max(120), pedido_id: z.uuid(),
          importe: moneySchema, fecha: z.iso.date(), medio: z.enum(["Efectivo", "Débito", "Crédito", "Transferencia"]),
          cotizacion_uyu_por_ars: z.number().positive().optional(), cobro_anterior_arg_minor: z.number().int().min(0).optional(), confirmado: z.literal(true) }),
        annotations: writeTool,
      }, async ({ clave_cobro, pedido_id, importe, fecha, medio, cotizacion_uyu_por_ars, cobro_anterior_arg_minor }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede registrar cobros." });
        let minor: number;
        try { minor = amountMinor(importe); } catch (error) { return failure({ error: (error as Error).message }); }
        const { data: order, error: lookupError } = await supabase.from("orders")
          .select("id,channel,reference_code,customer_name").eq("id", pedido_id).maybeSingle();
        if (lookupError || !order) return failure({ error: "No se encontró el pedido." });
        const id = await expenseId(identity.sub, `order-payment:${clave_cobro}`);
        const wholesale = order.channel === "Mayorista";
        if (!wholesale && !["Local", "Feria", "WhatsApp", "Instagram", "Facebook"].includes(order.channel))
          return failure({ error: "Este canal no admite cobros manuales desde Cuentas por cobrar." });
        if (wholesale && (!Number.isFinite(cotizacion_uyu_por_ars) || !(cotizacion_uyu_por_ars! > 0)))
          return failure({ error: "El cobro mayorista requiere cotización UYU por ARS." });
        const response = wholesale
          ? await supabase.rpc("gestion_record_wholesale_payment", { p_receipt_id: id, p_sale_id: pedido_id,
            p_source_amount_minor: minor, p_currency: "ARS", p_uyu_per_ars: cotizacion_uyu_por_ars,
            p_payment_method: medio, p_paid_on: fecha, p_opening_collected_arg_minor: cobro_anterior_arg_minor ?? null })
          : await supabase.rpc("gestion_record_local_sale_payment", { p_receipt_id: id, p_sale_id: pedido_id,
            p_amount_minor: minor, p_payment_method: medio, p_paid_on: fecha });
        return response.error ? failure({ error: response.error.message })
          : result({ estado: "registrado_o_ya_existia", id, pedido: order.reference_code,
            moneda: wholesale ? "ARS" : "UYU", datos: response.data, pagina: "https://matearte-gestion.vercel.app/finanzas/por-cobrar" });
      });

      server.registerTool("registrar_entrega_a_cuenta", {
        title: "Registrar entrega a cuenta de un cliente",
        description: "Solo Richard. Registra dinero recibido a favor de un cliente, sin asignarlo todavía a un pedido. Elegir ARS para mayorista y UYU para local. Mostrar el importe, moneda, cliente, fecha y cotización; pedir confirmación. No volver a contarlo como ingreso al asignarlo.",
        inputSchema: z.object({ clave_entrega: z.string().trim().min(8).max(120), cliente_id: z.uuid(),
          importe: moneySchema, moneda: z.enum(["UYU", "ARS"]), cotizacion_uyu_por_ars: z.number().positive().optional(),
          fecha: z.iso.date(), medio: z.enum(["Efectivo", "Débito", "Crédito", "Transferencia"]),
          nota: z.string().trim().max(500).optional(), confirmado: z.literal(true) }),
        annotations: writeTool,
      }, async ({ clave_entrega, cliente_id, importe, moneda, cotizacion_uyu_por_ars, fecha, medio, nota }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede registrar entregas a cuenta." });
        let minor: number;
        try { minor = amountMinor(importe); } catch (error) { return failure({ error: (error as Error).message }); }
        if (moneda === "ARS" && (!Number.isFinite(cotizacion_uyu_por_ars) || !(cotizacion_uyu_por_ars! > 0)))
          return failure({ error: "La entrega en ARS necesita cotización UYU." });
        const id = await expenseId(identity.sub, `account-receipt:${clave_entrega}`);
        const { data, error } = await supabase.rpc("gestion_record_customer_account_receipt", {
          p_receipt_id: id, p_contact_id: cliente_id, p_source_amount_minor: minor, p_currency: moneda,
          p_uyu_per_ars: moneda === "ARS" ? cotizacion_uyu_por_ars : null,
          p_payment_method: medio, p_paid_on: fecha, p_note: nota || null,
        });
        return error ? failure({ error: error.message }) : result({ estado: "registrado_o_ya_existia", id,
          datos: data, pagina: "https://matearte-gestion.vercel.app/finanzas/por-cobrar" });
      });

      server.registerTool("asignar_entrega_a_pedido", {
        title: "Asignar una entrega a cuenta a un pedido",
        description: "Solo Richard. Aplica un cobro ya registrado a un pedido del mismo cliente y moneda; no crea otro ingreso. Confirmar pedido, entrega, moneda e importe. Reutilizar clave_asignacion al reintentar.",
        inputSchema: z.object({ clave_asignacion: z.string().trim().min(8).max(120), entrega_id: z.uuid(),
          pedido_id: z.uuid(), importe: moneySchema, confirmado: z.literal(true) }), annotations: writeTool,
      }, async ({ clave_asignacion, entrega_id, pedido_id, importe }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede asignar entregas." });
        let minor: number;
        try { minor = amountMinor(importe); } catch (error) { return failure({ error: (error as Error).message }); }
        const id = await expenseId(identity.sub, `account-allocation:${clave_asignacion}`);
        const { data, error } = await supabase.rpc("gestion_allocate_customer_account_receipt", {
          p_allocation_id: id, p_receipt_id: entrega_id, p_order_id: pedido_id, p_source_amount_minor: minor,
        });
        return error ? failure({ error: error.message }) : result({ estado: "asignada_o_ya_existia", id,
          datos: data, pagina: "https://matearte-gestion.vercel.app/finanzas/por-cobrar" });
      });

      server.registerTool("crear_fiado_local", {
        title: "Crear pedido de Fiados Local",
        description: "Solo Richard. Crea un fiado del local por categorías, sin elegir SKU. Asociar un cliente local existente, un cliente vinculado o uno nuevo. Mostrar nombre, fecha, categorías e importes UYU, y pedir confirmación. Reutilizar clave_pedido al reintentar.",
        inputSchema: z.object({ clave_pedido: z.string().trim().min(8).max(120), fecha: z.iso.date(),
          cliente_local_id: z.uuid().optional(), cliente_vinculado_id: z.string().trim().min(1).max(120).optional(),
          cliente_nombre: z.string().trim().min(1).max(160).optional(), cliente_email: z.email().optional(),
          cliente_telefono: z.string().trim().max(80).optional(),
          categorias: z.array(z.object({ codigo: z.string().trim().min(1).max(80), importe_uyu: moneySchema })).min(1).max(30),
          confirmado: z.literal(true) }), annotations: writeTool,
      }, async ({ clave_pedido, fecha, cliente_local_id, cliente_vinculado_id, cliente_nombre, cliente_email, cliente_telefono, categorias }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede crear fiados locales." });
        if ([Boolean(cliente_local_id), Boolean(cliente_vinculado_id), Boolean(cliente_nombre && !cliente_vinculado_id)].filter(Boolean).length !== 1)
          return failure({ error: "Elegí exactamente un cliente local, uno vinculado o un cliente nuevo." });
        let lines: { category_code: string; amount_minor: number }[];
        try { lines = categorias.map((entry) => ({ category_code: entry.codigo, amount_minor: amountMinor(entry.importe_uyu) })); }
        catch (error) { return failure({ error: (error as Error).message }); }
        const requestId = await expenseId(identity.sub, `local-credit:${clave_pedido}`);
        const { data, error } = await supabase.rpc("gestion_mcp_create_local_credit_order", {
          p_request_id: requestId, p_customer_id: cliente_local_id || null,
          p_linked_customer_id: cliente_vinculado_id || null, p_customer_name: cliente_nombre || null,
          p_customer_email: cliente_email || null, p_customer_phone: cliente_telefono || null,
          p_sold_on: fecha, p_categories: lines,
        });
        return error ? failure({ error: error.message }) : result({ estado: "registrado_o_ya_existia", datos: data,
          pagina: "https://matearte-gestion.vercel.app/finanzas/fiados-local" });
      });

      server.registerTool("crear_consignacion", {
        title: "Crear consignación mayorista",
        description: "Solo Richard. Crea un acuerdo vinculado a un pedido de producción. Elegir cliente mayorista y variantes del catálogo con cantidades y precio ARS pactado. Enviar productos no crea deuda. Mostrar el acuerdo completo y pedir confirmación. Reutilizar clave_consignacion al reintentar.",
        inputSchema: z.object({ clave_consignacion: z.string().trim().min(8).max(120), cliente_id: z.uuid(),
          productos: z.array(z.object({ variante_id: z.uuid(), cantidad: z.number().int().min(1).max(10000),
            precio_unitario_ars: moneySchema })).min(1).max(100), confirmado: z.literal(true) }), annotations: writeTool,
      }, async ({ clave_consignacion, cliente_id, productos }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede crear consignaciones." });
        if (new Set(productos.map((item) => item.variante_id)).size !== productos.length)
          return failure({ error: "La consignación no puede repetir una variante." });
        let items: { variant_id: string; quantity: number; unit_price_arg_minor: number }[];
        try { items = productos.map((item) => ({ variant_id: item.variante_id,
          quantity: item.cantidad, unit_price_arg_minor: amountMinor(item.precio_unitario_ars) })); }
        catch (error) { return failure({ error: (error as Error).message }); }
        const id = await expenseId(identity.sub, `consignment:${clave_consignacion}`);
        const { data: previous, error: previousError } = await supabase.from("wholesale_consignments")
          .select("id,contact_id").eq("id", id).maybeSingle();
        if (previousError) return failure({ error: "No se pudo comprobar el reintento." });
        if (previous && previous.contact_id !== cliente_id) return failure({ error: "La clave ya corresponde a otro cliente." });
        if (previous) {
          const { data: lines, error: linesError } = await supabase.from("wholesale_consignment_lines")
            .select("variant_id,quantity,unit_price_arg_minor").eq("consignment_id", id);
          if (linesError || lines?.length !== items.length || items.some((item) => !lines?.some((line) =>
            line.variant_id === item.variant_id && Number(line.quantity) === item.quantity
            && Number(line.unit_price_arg_minor) === item.unit_price_arg_minor)))
            return failure({ error: "La clave ya corresponde a otra consignación." });
          return result({ estado: "ya_registrada", id });
        }
        const { data, error } = await supabase.rpc("gestion_create_wholesale_consignment", {
          p_id: id, p_contact_id: cliente_id, p_items: items,
        });
        return error ? failure({ error: error.message }) : result({ estado: "registrada", datos: data,
          pagina: "https://matearte-gestion.vercel.app/finanzas/consignaciones" });
      });

      server.registerTool("registrar_movimiento_consignacion", {
        title: "Registrar entrega, devolución o unidades conservadas",
        description: "Solo Richard. Registra cantidades por línea de consignación. La base impide enviar unidades no terminadas y mover más unidades que las disponibles. Confirmar cliente, línea, tipo, cantidad y fecha. Reutilizar clave_movimiento al reintentar.",
        inputSchema: z.object({ clave_movimiento: z.string().trim().min(8).max(120), linea_id: z.uuid(),
          tipo: z.enum(["dispatch", "return", "kept"]), cantidad: z.number().int().min(1).max(10000), fecha: z.iso.date(),
          transporte: z.string().trim().max(120).optional(), seguimiento: z.string().trim().max(120).optional(),
          nota: z.string().trim().max(500).optional(), confirmado: z.literal(true) }), annotations: writeTool,
      }, async ({ clave_movimiento, linea_id, tipo, cantidad, fecha, transporte, seguimiento, nota }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede registrar movimientos de consignación." });
        const id = await expenseId(identity.sub, `consignment-movement:${clave_movimiento}`);
        const { data: previous, error: previousError } = await supabase.from("wholesale_consignment_movements")
          .select("line_id,kind,quantity,occurred_on,carrier,tracking,note").eq("id", id).maybeSingle();
        if (previousError) return failure({ error: "No se pudo comprobar el reintento." });
        if (previous) return previous.line_id === linea_id && previous.kind === tipo && Number(previous.quantity) === cantidad
          && previous.occurred_on === fecha && previous.carrier === (transporte || null)
          && previous.tracking === (seguimiento || null) && previous.note === (nota || null)
          ? result({ estado: "ya_registrado", id }) : failure({ error: "La clave ya corresponde a otro movimiento." });
        const { data, error } = await supabase.rpc("gestion_record_wholesale_consignment_movement", {
          p_id: id, p_line_id: linea_id, p_kind: tipo, p_quantity: cantidad,
          p_occurred_on: fecha, p_carrier: transporte || null, p_tracking: seguimiento || null, p_note: nota || null,
        });
        return error ? failure({ error: error.message }) : result({ estado: "registrado_o_ya_existia", datos: data,
          pagina: "https://matearte-gestion.vercel.app/finanzas/consignaciones" });
      });

      server.registerTool("registrar_pago_consignacion", {
        title: "Registrar pago de una consignación",
        description: "Solo Richard. Cobro ARS que se aplica a unidades conservadas; si excede el cargo confirmado queda a favor. Mostrar importe, cotización, medio, fecha y consignación, y pedir confirmación. Reutilizar clave_pago al reintentar.",
        inputSchema: z.object({ clave_pago: z.string().trim().min(8).max(120), consignacion_id: z.uuid(),
          importe_ars: moneySchema, cotizacion_uyu_por_ars: z.number().positive(), fecha: z.iso.date(),
          medio: z.enum(["Efectivo", "Débito", "Crédito", "Transferencia"]), nota: z.string().trim().max(500).optional(),
          confirmado: z.literal(true) }), annotations: writeTool,
      }, async ({ clave_pago, consignacion_id, importe_ars, cotizacion_uyu_por_ars, fecha, medio, nota }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede registrar pagos de consignación." });
        let minor: number;
        try { minor = amountMinor(importe_ars); } catch (error) { return failure({ error: (error as Error).message }); }
        const receiptId = await expenseId(identity.sub, `consignment-receipt:${consignacion_id}:${clave_pago}`);
        const allocationId = await expenseId(identity.sub, `consignment-allocation:${consignacion_id}:${clave_pago}`);
        const { data, error } = await supabase.rpc("gestion_record_wholesale_consignment_payment", {
          p_receipt_id: receiptId, p_allocation_id: allocationId, p_consignment_id: consignacion_id,
          p_source_amount_minor: minor, p_uyu_per_ars: cotizacion_uyu_por_ars,
          p_payment_method: medio, p_paid_on: fecha, p_note: nota || null,
        });
        return error ? failure({ error: error.message }) : result({ estado: "registrado_o_ya_existia", datos: data,
          pagina: "https://matearte-gestion.vercel.app/finanzas/consignaciones" });
      });

      server.registerTool("asignar_pago_consignacion", {
        title: "Asignar un pago anticipado a consignación",
        description: "Solo Richard. Asigna un cobro ARS ya registrado al cargo confirmado de la consignación. No registra dinero nuevo. Confirmar cobro, consignación e importe; reutilizar clave_asignacion al reintentar.",
        inputSchema: z.object({ clave_asignacion: z.string().trim().min(8).max(120), consignacion_id: z.uuid(),
          cobro_id: z.uuid(), importe_ars: moneySchema, confirmado: z.literal(true) }), annotations: writeTool,
      }, async ({ clave_asignacion, consignacion_id, cobro_id, importe_ars }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede asignar cobros a consignaciones." });
        let minor: number;
        try { minor = amountMinor(importe_ars); } catch (error) { return failure({ error: (error as Error).message }); }
        const id = await expenseId(identity.sub, `consignment-reallocate:${clave_asignacion}`);
        const { data, error } = await supabase.rpc("gestion_allocate_wholesale_consignment_receipt", {
          p_id: id, p_receipt_id: cobro_id, p_consignment_id: consignacion_id, p_source_amount_minor: minor,
        });
        return error ? failure({ error: error.message }) : result({ estado: "asignado_o_ya_existia", datos: data,
          pagina: "https://matearte-gestion.vercel.app/finanzas/consignaciones" });
      });

      server.registerTool("guardar_costo_inventario", {
        title: "Agregar o actualizar insumo o artículo de reventa",
        description: "Solo Richard. Guarda un insumo de fabricación o el costo de compra de un artículo de reventa, con moneda y cotización del momento. Consultar catálogo y costos previos, mostrar el cambio y pedir confirmación. No crea existencias ni egresos financieros.",
        inputSchema: z.object({ tipo: z.enum(["insumo", "reventa"]), clave_carga: z.string().trim().min(8).max(120),
          costo_id: z.uuid().optional(), categoria: z.string().trim().min(1).max(80),
          nombre: z.string().trim().min(1).max(120).optional(), grupo: z.string().trim().min(1).max(60).optional(),
          variante_id: z.uuid().optional(), modo: z.enum(["per_product", "purchase_quantity"]).default("per_product"),
          importe: moneySchema.optional(), moneda: currencySchema.default("UYU"), cotizacion_uyu: z.number().positive().optional(),
          cantidad_comprada: z.number().positive().optional(), cantidad_usada: z.number().positive().optional(),
          unidad: z.string().trim().min(1).max(30).optional(), confirmado: z.literal(true) }),
        annotations: writeTool,
      }, async ({ tipo, clave_carga, costo_id, categoria, nombre, grupo, variante_id, modo, importe, moneda,
        cotizacion_uyu, cantidad_comprada, cantidad_usada, unidad }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede guardar costos de inventario." });
        if (tipo === "insumo" && (!nombre || variante_id) || tipo === "reventa" && (!variante_id || modo !== "per_product"))
          return failure({ error: "Revisá el nombre del insumo o el artículo de reventa." });
        if (modo === "purchase_quantity" && (!cantidad_comprada || !cantidad_usada || !unidad))
          return failure({ error: "Indicá cantidad comprada, usada y unidad." });
        if (importe && moneda !== "UYU" && (!Number.isFinite(cotizacion_uyu) || !(cotizacion_uyu! > 0)))
          return failure({ error: "Falta la cotización UYU del costo." });
        let minor: number | null = null;
        if (importe !== undefined) {
          try { minor = nonNegativeMinor(importe); }
          catch (error) { return failure({ error: (error as Error).message }); }
        }
        const { data: category, error: categoryError } = await supabase.from("commerce_categories")
          .select("code,label_es").eq("code", categoria).eq("active", true).maybeSingle();
        if (categoryError || !category) return failure({ error: "La categoría de catálogo no existe o no está activa." });
        let articleName = nombre;
        if (tipo === "reventa") {
          const { data: variant, error: variantError } = await supabase.from("commerce_variants")
            .select("id,name,product_id,commerce_products!inner(name,category_code)").eq("id", variante_id!).maybeSingle();
          if (variantError || !variant) return failure({ error: "La variante no existe." });
          const product = variant.commerce_products as unknown as { name: string; category_code: string };
          if (product.category_code !== categoria) return failure({ error: "La variante no pertenece a esa categoría." });
          articleName = `${product.name} - ${variant.name}`;
        }
        let profileId: string;
        const { data: profile, error: profileError } = await supabase.from("inventory_cost_profiles")
          .select("id").eq("category_code", categoria).maybeSingle();
        if (profileError) return failure({ error: "No se pudo consultar el perfil de costo." });
        if (profile) profileId = profile.id;
        else {
          const created = await supabase.from("inventory_cost_profiles")
            .upsert({ category_code: categoria, name: category.label_es,
              method: tipo === "reventa" ? "reventa" : "fabricacion", benchmark_material_minor: null },
              { onConflict: "category_code", ignoreDuplicates: true }).select("id").maybeSingle();
          if (created.error) return failure({ error: "No se pudo crear el perfil de costo." });
          if (created.data?.id) profileId = created.data.id;
          else {
            const found = await supabase.from("inventory_cost_profiles").select("id").eq("category_code", categoria).single();
            if (found.error || !found.data) return failure({ error: "No se pudo recuperar el perfil de costo." });
            profileId = found.data.id;
          }
        }
        const id = costo_id || await expenseId(identity.sub, `inventory-cost:${clave_carga}`);
        const { data: prior, error: priorError } = await supabase.from("inventory_cost_lines")
          .select("id,kind,profile_id,catalog_variant_id,sort_order").eq("id", id).maybeSingle();
        if (priorError) return failure({ error: "No se pudo comprobar el costo previo." });
        if (prior && (prior.profile_id !== profileId || Boolean(prior.catalog_variant_id) !== (tipo === "reventa")))
          return failure({ error: "El costo existente pertenece a otra categoría o tipo." });
        const kind = prior?.kind || (tipo === "reventa" ? "purchase" : "supply");
        if (tipo === "insumo" && kind === "purchase" || tipo === "reventa" && kind !== "purchase")
          return failure({ error: "El tipo del costo existente no coincide." });
        const row = { id, profile_id: profileId, name: articleName!, group_name: tipo === "insumo" ? grupo || "Otros" : "Otros",
          kind, mode: modo, amount_minor: minor, currency: moneda,
          exchange_rate_to_uyu: moneda === "UYU" ? null : cotizacion_uyu ?? null,
          purchase_quantity: modo === "purchase_quantity" ? cantidad_comprada : null,
          consumption_quantity: modo === "purchase_quantity" ? cantidad_usada : null,
          unit: modo === "purchase_quantity" ? unidad : null,
          catalog_variant_id: tipo === "reventa" ? variante_id : null, sort_order: prior?.sort_order ?? 0 };
        const { error } = await supabase.from("inventory_cost_lines").upsert(row);
        return error ? failure({ error: "No se pudo guardar el costo.", detalle: error.message })
          : result({ estado: prior ? "actualizado" : "registrado", id,
            pagina: `https://matearte-gestion.vercel.app/inventario/${tipo === "reventa" ? "reventa" : "insumos"}` });
      });

      server.registerTool("guardar_producto_fabricado", {
        title: "Vincular producto fabricado con sus insumos",
        description: "Solo Richard. Vincula un producto del catálogo, sin seleccionar variante, a insumos de su categoría y cantidades positivas. Usa una operación única en la base: si una línea falla, no deja el producto a medias. Mostrar producto, categoría e insumos, y pedir confirmación. Reutilizar clave_producto al reintentar.",
        inputSchema: z.object({ clave_producto: z.string().trim().min(8).max(120), producto_id: z.uuid().optional(),
          producto_catalogo_id: z.uuid(), costo_referencia_uyu: moneySchema.optional(),
          insumos: z.array(z.object({ insumo_id: z.uuid(), cantidad: z.number().positive() })).max(100), confirmado: z.literal(true) }),
        annotations: writeTool,
      }, async ({ clave_producto, producto_id, producto_catalogo_id, costo_referencia_uyu, insumos }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede guardar productos fabricados." });
        if (new Set(insumos.map((item) => item.insumo_id)).size !== insumos.length)
          return failure({ error: "Un insumo figura más de una vez." });
        let referenceMinor: number | null = null;
        if (costo_referencia_uyu !== undefined) {
          try { referenceMinor = nonNegativeMinor(costo_referencia_uyu); }
          catch (error) { return failure({ error: (error as Error).message }); }
        }
        const id = producto_id || await expenseId(identity.sub, `manufactured:${clave_producto}`);
        const { data, error } = await supabase.rpc("gestion_mcp_save_manufactured_product", {
          p_id: id, p_catalog_product_id: producto_catalogo_id, p_reference_cost_minor: referenceMinor,
          p_supplies: insumos.map((item) => ({ cost_line_id: item.insumo_id, quantity: item.cantidad })),
        });
        return error ? failure({ error: error.message }) : result({ estado: "guardado", datos: data,
          pagina: "https://matearte-gestion.vercel.app/inventario/fabricados" });
      });

      server.registerTool("actualizar_cotizacion", {
        title: "Actualizar cotización comercial",
        description: "Solo Richard. Cambia la cotización vigente en UYU por ARS, USD o BRL. ARS usa la cotización mayorista del dashboard. Los movimientos antiguos conservan la cotización que tenían al registrarse. Mostrar valor anterior y nuevo, y pedir confirmación.",
        inputSchema: z.object({ moneda: z.enum(["ARS", "USD", "BRL"]), uyu_por_unidad: z.number().positive(), confirmado: z.literal(true) }),
        annotations: writeTool,
      }, async ({ moneda, uyu_por_unidad }) => {
        if (!canWrite) return failure({ error: "Solo Richard puede actualizar cotizaciones." });
        if (moneda === "ARS") {
          const { data: previous, error: readError } = await supabase.from("settings").select("exchange_rate").eq("id", 1).single();
          if (readError) return failure({ error: "No se pudo consultar la cotización anterior." });
          if (Number(previous.exchange_rate) === uyu_por_unidad) return result({ estado: "sin_cambios", moneda, uyu_por_unidad });
          const { error } = await supabase.from("settings").update({ exchange_rate: uyu_por_unidad }).eq("id", 1);
          return error ? failure({ error: error.message }) : result({ estado: "actualizada", moneda,
            anterior: previous.exchange_rate, actual: uyu_por_unidad, pagina: "https://matearte-gestion.vercel.app/finanzas/monedas" });
        }
        const { data: previous, error: readError } = await supabase.from("commerce_exchange_rates")
          .select("rate_to_uyu").eq("currency_code", moneda).maybeSingle();
        if (readError) return failure({ error: "No se pudo consultar la cotización anterior." });
        if (Number(previous?.rate_to_uyu) === uyu_por_unidad) return result({ estado: "sin_cambios", moneda, uyu_por_unidad });
        const { error } = await supabase.from("commerce_exchange_rates")
          .upsert({ currency_code: moneda, rate_to_uyu: uyu_por_unidad });
        return error ? failure({ error: error.message }) : result({ estado: "actualizada", moneda,
          anterior: previous?.rate_to_uyu ?? null, actual: uyu_por_unidad, pagina: "https://matearte-gestion.vercel.app/finanzas/monedas" });
      });

        server.registerTool("registrar_gastos", {
          title: "Registrar gastos de Richard en Finanzas",
          description: "Crea hasta 25 gastos en Compras/Finanzas con la sesión de Richard. Puede usar movimientos de un estado de cuenta que Richard adjunte al chat: registrar solo débitos que sean gastos, nunca créditos, transferencias entre cuentas ni el archivo PDF. Antes de llamar, mostrarle fechas, conceptos, importes, monedas, categorías y total por moneda, y pedirle confirmación explícita. Usar una clave estable por movimiento y reutilizarla en reintentos. Si hay coincidencias con gastos existentes, revisar con Richard antes de permitirlas.",
          inputSchema: z.object({
            gastos: z.array(expenseInput).min(1).max(25),
            confirmado: z.literal(true).describe("Solo true después de mostrar el resumen y recibir confirmación explícita de Richard para este lote."),
            permitir_coincidencias: z.boolean().default(false).describe("Solo true si Richard confirma expresamente que los movimientos marcados como posibles duplicados son gastos distintos."),
          }),
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        }, async ({ gastos, permitir_coincidencias }) => {
          if (!canWrite) return failure({ error: "Solo la cuenta de Gestión de Richard puede registrar gastos por este MCP." });
          const { data: categories, error: categoryError } = await supabase.from("expense_categories")
            .select("name").eq("active", true).in("kind", ["compra", "ambas"]);
          if (categoryError) return failure({ error: "No se pudieron validar las categorías. No se registró ningún gasto." });
          const allowed = new Set((categories ?? []).map((category) => category.name));
          if (gastos.some((gasto) => !allowed.has(gasto.categoria)))
            return failure({ error: "Hay una categoría inexistente o inactiva. No se registró ningún gasto.", categorias: [...allowed] });
          if (new Set(gastos.map((gasto) => gasto.clave_movimiento)).size !== gastos.length)
            return failure({ error: "Cada movimiento del lote necesita una clave distinta. No se registró ningún gasto." });

          let rows: ReturnType<typeof expenseRow>[];
          try {
            rows = await Promise.all(gastos.map(async (gasto) => expenseRow(gasto, await expenseId(identity.sub, gasto.clave_movimiento))));
          } catch (error) {
            return failure({ error: error instanceof Error ? error.message : "Hay un gasto inválido.", registrados: 0 });
          }
          const { data: existing, error: existingError } = await supabase.from("purchases")
            .select(expenseColumns).in("id", rows.map((row) => row.id));
          if (existingError) return failure({ error: "No se pudieron comprobar los reintentos. No se registró ningún gasto." });
          const byId = new Map((existing ?? []).map((row) => [row.id, row]));
          const changed = rows.find((row) => byId.has(row.id) && !sameExpense(row, byId.get(row.id) as typeof row));
          if (changed) return failure({ error: "La clave de un movimiento ya corresponde a un gasto con otros datos. Revisá el gasto existente; no se registró ningún gasto.", id: changed.id });

          const possibleDuplicates: { indice: number; id_existente?: string }[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (byId.has(row.id)) continue;
            if (rows.slice(0, i).some((previous) => previous.id !== row.id && previous.purchased_on === row.purchased_on && previous.description === row.description && previous.amount_minor === row.amount_minor && previous.currency === row.currency))
              possibleDuplicates.push({ indice: i + 1 });
            const { data: matches, error } = await supabase.from("purchases").select("id")
              .eq("purchased_on", row.purchased_on).eq("description", row.description)
              .eq("amount_minor", row.amount_minor).eq("currency", row.currency).limit(1);
            if (error) return failure({ error: "No se pudo comprobar si hay gastos repetidos. No se registró ningún gasto." });
            if (matches?.[0] && matches[0].id !== row.id) possibleDuplicates.push({ indice: i + 1, id_existente: matches[0].id });
          }
          if (possibleDuplicates.length && !permitir_coincidencias)
            return failure({ error: "Hay movimientos que coinciden con gastos existentes o del mismo lote. No se registró ningún gasto. Pedí a Richard que los revise.", posibles_duplicados: possibleDuplicates });

          const outcome: { indice: number; id: string; estado: string }[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (byId.has(row.id)) { outcome.push({ indice: i + 1, id: row.id, estado: "ya_registrado" }); continue; }
            const { error } = await supabase.from("purchases").insert(row);
            if (error) return failure({ error: "No se pudo registrar un gasto. Revisá el detalle y reintentá con las mismas claves; los ya registrados no se duplicarán.", detalle: outcome, indice_fallido: i + 1 });
            outcome.push({ indice: i + 1, id: row.id, estado: "registrado" });
          }
          return result({ detalle: outcome, registrados: outcome.filter((entry) => entry.estado === "registrado").length, ya_registrados: outcome.filter((entry) => entry.estado === "ya_registrado").length, pagina: "https://matearte-gestion.vercel.app/finanzas/egresos" });
        });

      server.registerTool("listar_opciones_alta_producto", {
        title: "Consultar opciones para dar de alta un producto",
        description: "Lista categorías activas o los atributos y colores de una categoría. Para Personalizados, indicá si es Mate o Matera cuando se sepa. No modifica datos.",
        inputSchema: z.object({
          categoria: z.string().max(80).optional(),
          tipo_personalizado: z.enum(["mate", "matera"]).optional(),
          tipo_mate: z.enum(["imperial", "camionero", "criollo", "torpedo"]).optional(),
        }),
        annotations: readOnly,
      }, async ({ categoria, tipo_personalizado, tipo_mate }) => {
        try {
          const taxonomy = await loadMcpCatalogTaxonomy(supabase);
          const active = taxonomy.categories.filter((entry) => entry.active && entry.code !== "servicios");
          if (!categoria) return result({ categorias: active.map(({ code, label_es }) => ({ codigo: code, nombre: label_es })) });
          if (!active.some((entry) => entry.code === categoria)) return failure({ error: "La categoría no está activa." });
          const attributes = {
            ...(tipo_personalizado ? { "tipo-personalizado": tipo_personalizado } : {}),
            ...(tipo_mate ? { "tipo-mate": tipo_mate } : {}),
          };
          return result({ categoria, atributos: productOptions(taxonomy, categoria, attributes) });
        } catch {
          return failure({ error: "No se pudo consultar la configuración del catálogo." });
        }
      });

      server.registerTool("registrar_producto", {
        title: "Crear una ficha de producto en borrador",
        description: "Solo Richard. Crea una ficha nueva en Gestión con variantes opcionales, todas fuera de venta hasta revisarlas en el panel. Consultá primero listar_opciones_alta_producto. Mostrá nombre, categoría, atributos y variantes y pedí confirmación antes de guardar. Reutilizá clave_alta en reintentos.",
        inputSchema: productInput,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      }, async (input) => {
        if (!canWrite) return failure({ error: "Solo la cuenta de Gestión de Richard puede registrar productos por este MCP." });
        try {
          const draft = catalogDraft(input, await loadMcpCatalogTaxonomy(supabase));
          const { data, error } = await supabase.rpc("gestion_mcp_create_catalog_product", {
            p_request_id: input.clave_alta, p_product: draft.product, p_variants: draft.variants,
          });
          if (error?.code === "23505") return failure({ error: "Ya existe un producto, SKU o clave de alta con esos datos. Revisá el catálogo antes de reintentar." });
          if (error?.code === "22023") return failure({ error: error.message });
          if (error || !data) return failure({ error: "No se pudo confirmar el alta. Reintentá con la misma clave." });
          return result({ ...data, pagina: "https://matearte-gestion.vercel.app/productos/catalogo" });
        } catch (error) {
          return failure({ error: error instanceof Error ? error.message : "No se pudo preparar el alta." });
        }
      });

      server.registerTool("consultar_registros", {
        title: "Consultar registros de Gestión",
        description: "Lee una página de una fuente permitida. Permite buscar por nombre o código, filtrar por fecha o buscar un identificador exacto. En catálogo y variantes incluye la foto oficial de Gestión en image_url/images y, para un único resultado, como imagen adjunta. Mostrá solo esa foto; si no hay imagen oficial, no sustituyas por otra. Los importes con sufijo _minor están en centésimos. No modifica datos.",
        inputSchema: z.object({
          fuente: z.enum(datasetNames),
          id: z.string().min(1).max(120).optional(),
          buscar: z.string().min(1).max(100).optional(),
          desde: z.iso.date().optional(),
          hasta: z.iso.date().optional(),
          limite: z.number().int().min(1).max(50).default(20),
          pagina: pageSchema,
          canal: z.string().min(1).max(60).optional(),
          estado: z.string().min(1).max(60).optional(),
          pedido_id: z.uuid().optional(),
          cliente_id: z.uuid().optional(),
          consignacion_id: z.uuid().optional(),
          linea_id: z.uuid().optional(),
          perfil_id: z.uuid().optional(),
          producto_id: z.uuid().optional(),
          referencia: z.string().min(1).max(120).optional(),
          categoria: z.string().min(1).max(120).optional(),
          sku: z.string().min(1).max(120).optional(),
        }), annotations: readOnly,
      }, async ({ fuente, id, buscar, desde, hasta, limite, pagina: requestedPage, ...exactFilters }) => {
        const pagina = pageNumber(requestedPage);
        const dataset = datasets[fuente] as Dataset;
        if (dataset.richardOnly && !canWrite) return failure({ error: "Solo Richard puede consultar los costos de inventario." });
        if (buscar && !dataset.search) return failure({ error: "Esta fuente no admite búsqueda de texto." });
        if ((desde || hasta) && !dataset.date) return failure({ error: "Esta fuente no admite fechas." });
        if (desde && hasta && desde > hasta) return failure({ error: "El inicio debe ser anterior al fin." });
        const supported = filters[fuente] ?? {};
        for (const [name, value] of Object.entries(exactFilters)) {
          if (value !== undefined && !supported[name]) return failure({ error: `Esta fuente no admite el filtro ${name}.`, filtros_disponibles: Object.keys(supported) });
        }
        const safe = buscar?.trim().replace(/[^\p{L}\p{N}\s.@-]/gu, "").slice(0, 100);
        if (buscar && !safe) return failure({ error: "Ingresá un texto de búsqueda válido." });
        const makeQuery = () => {
        let query = supabase.from(dataset.table).select(dataset.columns, { count: "exact" });
        if (dataset.requiredKind) query = query.eq("kind", dataset.requiredKind);
        if (dataset.webOrdersOnly) query = query.not(dataset.parentOrders ? "orders.channel" : "channel", "in", "(Mayorista,Local,Feria,WhatsApp,Instagram,Facebook)");
        if (id) query = query.eq(dataset.key, id);
        for (const [name, value] of Object.entries(exactFilters)) if (value !== undefined) query = query.eq(supported[name], value);
        if (safe && dataset.search) {
          query = query.ilike(dataset.search, `%${safe}%`);
        }
        const timestamp = dataset.date?.endsWith("_at");
        if (desde && dataset.date) query = query.gte(dataset.date, timestamp ? `${desde}T03:00:00Z` : desde);
        if (hasta && dataset.date) {
          const nextDay = new Date(`${hasta}T00:00:00Z`);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          query = timestamp ? query.lt(dataset.date, `${nextDay.toISOString().slice(0, 10)}T03:00:00Z`) : query.lte(dataset.date, hasta);
        }
        query = query.order(dataset.order, { ascending: false });
        if (dataset.order !== dataset.key) query = query.order(dataset.key, { ascending: false });
        return query;
        };
        const start = (pagina - 1) * limite;
        const { data, count, error, outOfRange } = await readPage((from, to) => makeQuery().range(from, to), pagina, limite);
        if (error) return failure({ fuente, error: queryErrorMessage(error) });
        let registros = (data ?? []) as unknown as CatalogRecord[];
        let selectedImagePath: string | undefined;
        if (fuente === "imagenes_catalogo") {
          registros = registros.map((image) => ({ ...image, image_url: imageUrl(supabase, image.storage_path!) }));
        }
        if ((fuente === "catalogo" || fuente === "variantes") && registros.length) {
          const productIds = [...new Set(registros.map((row) => fuente === "catalogo" ? row.id : row.product_id).filter((value): value is string => Boolean(value)))];
          const { data: images, error: imageError } = await supabase.from("commerce_product_images")
            .select("product_id,variant_id,storage_path,sort_order,option_values").in("product_id", productIds);
          if (!imageError) {
            const byProduct = new Map<string, CatalogImage[]>();
            for (const image of (images ?? []) as unknown as CatalogImage[]) byProduct.set(image.product_id, [...(byProduct.get(image.product_id) ?? []), image]);
            registros = registros.map((row) => {
              const cover = catalogCover(byProduct.get(fuente === "catalogo" ? row.id : row.product_id!) ?? [], fuente === "variantes" ? row : undefined);
              if (registros.length === 1) selectedImagePath = cover?.storage_path;
              const url = cover ? imageUrl(supabase, cover.storage_path) : null;
              return { ...row, imagen_principal_url: url, image_url: url, images: url ? [url] : [] };
            });
          }
        }
        const response = result({ fuente, pagina, limite, total: count ?? 0, fuera_de_rango: outOfRange, primera_pagina: 1, siguiente_pagina: count != null && start + registros.length < count ? pagina + 1 : null, registros });
        if (selectedImagePath && (id || buscar)) {
          try {
            const photo = await fetch(imageUrl(supabase, selectedImagePath), { signal: AbortSignal.timeout(5_000) });
            if (photo.ok && /^image\/(png|jpeg|webp)$/.test(photo.headers.get("content-type") || "") && Number(photo.headers.get("content-length") || 0) <= 3_000_000) {
              const bytes = new Uint8Array(await photo.arrayBuffer());
              if (bytes.length <= 3_000_000) response.content.push({ type: "image", mimeType: photo.headers.get("content-type")!, data: encodeImage(bytes) });
            }
          } catch {
            // The verified URL remains in the text result if the image download fails.
          }
        }
        return response;
      });

      server.registerTool("resumir_ventas_locales", {
        title: "Resumen de ventas, cobros y saldos del local, feria y redes",
        description: "Calcula todas las ventas del período, sin sumar solo una página. Local es el canal por defecto; también admite Feria, WhatsApp, Instagram, Facebook o todos. Separa monedas. Lo cobrado corresponde a esas ventas y a sus cobros hasta la fecha final inclusive: NO es el flujo de caja de todas las ventas de otros períodos. Respeta las señas sin duplicarlas. Máximo 366 días; si excede los límites, pide reducir el período y nunca devuelve un total parcial. Importes _minor en centésimos.",
        inputSchema: z.object({
          desde: z.iso.date(), hasta: z.iso.date(),
          canal: z.enum(["Local", "Feria", "WhatsApp", "Instagram", "Facebook", "todos"]).default("Local"),
        }), annotations: readOnly,
      }, async ({ desde, hasta, canal }) => {
        const days = (Date.parse(hasta) - Date.parse(desde)) / 86_400_000;
        if (days < 0 || days >= 366) return failure({ error: "Elegí un período de entre 1 y 366 días." });
        try {
          const sales = await readAll((from, to) => {
            let query = supabase.from("local_sales").select("id,channel,currency,total_minor,deposit_minor,payment_method,retail_shipping_minor", { count: "exact" })
              .gte("sold_on", desde).lte("sold_on", hasta);
            if (canal !== "todos") query = query.eq("channel", canal);
            return query.order("id").range(from, to);
          }) as LocalSale[];
          const items: LocalItem[] = [];
          const receipts: LocalReceipt[] = [];
          // Separate paginated reads avoid silently truncated embedded line items.
          for (let offset = 0; offset < sales.length; offset += 100) {
            const ids = sales.slice(offset, offset + 100).map((sale) => sale.id);
            const batchItems = await readAll((from, to) => supabase.from("local_sale_items")
              .select("sale_id,line_total_minor", { count: "exact" }).in("sale_id", ids).order("id").range(from, to), 10_000 - items.length);
            items.push(...batchItems as LocalItem[]);
            const batchReceipts = await readAll((from, to) => supabase.from("local_sale_receipts")
              .select("sale_id,amount_minor", { count: "exact" }).in("sale_id", ids).lte("paid_on", hasta).order("id").range(from, to), 10_000 - receipts.length);
            receipts.push(...batchReceipts as LocalReceipt[]);
          }
          return result({ desde, hasta, canal, cantidad_ventas: sales.length, completo: true,
            alcance: "Ventas realizadas en el período, con sus cobros registrados hasta la fecha final inclusive. No incluye cobros de ventas anteriores al período. El saldo refleja los registros actuales de esas ventas. No sumar monedas distintas.",
            grupos: summarizeLocalSales(sales, items, receipts) });
        } catch (error) {
          return failure({ error: error instanceof Error ? error.message : "No se pudo completar el resumen. No se devolverán totales parciales." });
        }
      });

      server.registerTool("consultar_clientes_web", {
        title: "Consultar clientes web",
        description: "Lee perfiles de clientes registrados o consultas web, como en la base de clientes de Gestión.",
        inputSchema: z.object({
          tipo: z.enum(["perfiles", "consultas"]),
          pagina: pageSchema,
        }), annotations: readOnly,
      }, async ({ tipo, pagina: requestedPage }) => {
        const pagina = pageNumber(requestedPage);
        const name = tipo === "perfiles" ? "gestion_customer_profile_details_full" : "gestion_web_leads";
        const { data, error } = await supabase.rpc(name, { p_offset: (pagina - 1) * 50, p_limit: 50 });
        if (error) return failure({ tipo, error: queryErrorMessage(error) });
        return result({ tipo, pagina, siguiente_pagina: (data?.length ?? 0) === 50 ? pagina + 1 : null, registros: data ?? [] });
      });

      server.registerTool("consultar_marketing", {
        title: "Consultar Marketing",
        description: "Lee contactos, campañas, métricas, suscripción o Analytics usando las mismas lecturas autenticadas de Gestión.",
        inputSchema: z.object({
          consulta: z.enum(mcpMarketingReads),
          pagina: pageSchema,
          buscar: z.string().max(100).default(""),
          sitio: z.enum(["tienda", "personalizador"]).default("tienda"),
          dias: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]).default(30),
        }), annotations: readOnly,
      }, async ({ consulta, pagina, buscar, sitio, dias }) => {
        const { data, error } = await supabase.functions.invoke("marketing-workspace", {
          body: { action: consulta, page: pageNumber(pagina) - 1, query: buscar, site: sitio, days: dias },
          headers: { [mcpProofHeader]: await signMcpRequest(bridgeKey, identity, `marketing:${consulta}`) },
        });
        if (error || data?.error) return failure({ consulta, error: "No se pudo consultar Marketing." });
        return result({ consulta, datos: data });
      });
      return server;
    });
    return handler.fetch(request);
  },
));
