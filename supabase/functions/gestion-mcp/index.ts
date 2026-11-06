import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.3.1";
import { pipeline } from "npm:@supabase/middleware@1.0.0";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1.9.2";
import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import { z } from "npm:zod@4.6.7";
import { pageNumber, queryErrorMessage, readAll, readPage, summarizeLocalSales, type LocalSale, type LocalItem, type LocalReceipt } from "./queries.ts";
import { expenseId, expenseRow, sameExpense } from "./financeWrites.ts";
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
};

// Explicit columns keep payment payloads, auth data and other hidden fields out of MCP results.
const datasets = {
  pedidos_web: { table: "orders", columns: "id,order_number,reference_code,status,channel,currency,total_minor,shipping_minor,discount_minor,paid_at,created_at,customer_snapshot,shipping_snapshot,shipping_method,shipping_carrier,tracking_code", key: "id", order: "created_at", search: "customer_name", date: "created_at", path: "/comercial/pedidos", description: "Pedidos web, envíos, estados e importes; excluye canales internos para evitar duplicados.", webOrdersOnly: true },
  articulos_web: { table: "order_items", columns: "id,order_id,title,sku,quantity,unit_price_minor,total_minor,item_type,immutable_snapshot,requires_review,review_status,production_status,completed_at,created_at,orders!inner(channel,reference_code)", key: "id", order: "created_at", search: "title", date: "created_at", path: "/produccion/resumen", description: "Artículos exclusivamente de pedidos web, personalización y producción.", webOrdersOnly: true, parentOrders: true },
  pedidos: { table: "orders", columns: "id,order_number,reference_code,customer_name,status,channel,currency,total_minor,deposit_minor,shipping_minor,discount_minor,paid_at,sold_on,created_at,shipping_method,shipping_carrier,tracking_code,shipped_at,delivered_at", key: "id", order: "created_at", search: "customer_name", date: "created_at", path: "/comercial/pedidos", description: "Pedidos de todos los canales, estado, despacho y entrega. No sumar con pedidos_web: son los mismos pedidos. Para totales locales usar resumir_ventas_locales." },
  produccion: { table: "order_items", columns: "id,order_id,title,sku,quantity,item_type,requires_review,review_status,production_status,completed_at,created_at,orders!inner(reference_code,channel,customer_name,status,shipping_method,shipped_at,delivered_at)", key: "id", order: "created_at", search: "title", date: "created_at", path: "/produccion/resumen", description: "Artículos y estado de producción de todos los canales, con pedido y entrega relacionados.", parentOrders: true },
  reportes_publicidad: { table: "ad_reports", columns: "id,period_start,period_end,platform,currency,campaigns,deposit_minor,deposit_on,previous_balance_minor,notes,created_at", key: "id", order: "period_start", date: "period_start", path: "/marketing/pauta", description: "Reportes de publicidad, campañas, depósitos y saldos; fechas filtran el inicio del período." },
  ventas_locales: { table: "local_sales", columns: "id,sale_number,reference_code,channel,customer_id,customer_name,sold_on,payment_method,total_minor,deposit_minor,currency,created_at", key: "id", order: "sold_on", search: "customer_name", date: "sold_on", path: "/comercial/pedidos", description: "Ventas de local, feria y redes." },
  articulos_locales: { table: "local_sale_items", columns: "id,sale_id,variant_id,sku,product_name,variant_name,quantity,unit_price_minor,line_total_minor,customization,production_status,production_notes,created_at", key: "id", order: "created_at", search: "product_name", date: "created_at", path: "/produccion/resumen", description: "Artículos vendidos por canales internos y su personalización." },
  cobros_locales: { table: "local_sale_receipts", columns: "id,sale_id,amount_minor,payment_method,paid_on,created_at", key: "id", order: "paid_on", date: "paid_on", path: "/finanzas/cobros", description: "Cobros posteriores de ventas locales; no incluye el cobro inicial registrado en ventas_locales.total_minor." },
  pagos_web: { table: "commerce_payments", columns: "id,order_id,provider,status,amount_minor,currency,approved_at,created_at", key: "id", order: "created_at", date: "created_at", path: "/finanzas/cobros", description: "Pagos de pedidos web, sin datos internos del proveedor." },
  comprobantes_transferencia: { table: "commerce_bank_transfer_receipts", columns: "id,order_id,status,submitted_at", key: "id", order: "submitted_at", date: "submitted_at", path: "/finanzas/cobros", description: "Estado y fecha de comprobantes de transferencia de pedidos web." },
  pedidos_mayoristas: { table: "order_lines", columns: "line_id,order_id,customer,model,variant,quantity,status,created_at,completed_at,unit_price_arg,unit_price_uyu,total_arg,total_uyu,exchange_rate,order_type,sale_channel", key: "line_id", order: "created_at", search: "customer", date: "created_at", path: "/comercial/pedidos", description: "Líneas y montos de pedidos mayoristas." },
  catalogo: { table: "commerce_products", columns: "id,name,editorial_slug,category,category_code,description,sale_mode,published,attributes,peso,updated_at", key: "id", order: "name", search: "name", path: "/productos/catalogo", description: "Productos del catálogo." },
  variantes: { table: "commerce_variants", columns: "id,product_id,sku,name,price_minor,base_price_minor,wholesale_price_arg,currency,active,available_local,available_web,available_wholesale,color,weight_grams,rim_type,leather_type,option_values,updated_at", key: "id", order: "sku", search: "sku", path: "/productos/catalogo", description: "Variantes, precios y disponibilidad." },
  imagenes_catalogo: { table: "commerce_product_images", columns: "id,product_id,variant_id,storage_path,alt_text,sort_order,option_values", key: "id", order: "sort_order", search: "alt_text", path: "/productos/catalogo", description: "Imágenes y asociación a productos o variantes del catálogo." },
  clientes_locales: { table: "local_sales_customers", columns: "id,full_name,company_name,email,phone,address,city,country,department,postal_code,product_interest,birth_date,first_purchase_date,last_purchase_date,notes,origin_channel,customer_type,updated_at", key: "id", order: "full_name", search: "full_name", path: "/clientes/base", description: "Clientes de ventas locales y redes." },
  clientes_mayoristas: { table: "customers", columns: "full_name,company_name,first_name,last_name,email,phone,address,city,country,department,postal_code,notes,origin_channel,customer_type", key: "full_name", order: "full_name", search: "full_name", path: "/clientes/base", description: "Contactos mayoristas." },
  sorteo: { table: "rural_raffle_entries", columns: "id,full_name,company_name,email,phone,address,city,country,department,postal_code,birth_date,product_interest,origin_channel,customer_type,marketing_opt_in,created_at", key: "id", order: "created_at", search: "full_name", date: "created_at", path: "/marketing/sorteo", description: "Inscripciones al sorteo." },
  compras: { table: "purchases", columns: "id,purchased_on,supplier,description,category,amount_minor,currency,payment_method,status,paid_on,invoice_number,notes,created_at", key: "id", order: "purchased_on", search: "description", date: "purchased_on", path: "/inventario/compras", description: "Compras y gastos variables." },
  gastos_fijos: { table: "fixed_expenses", columns: "id,name,category,amount_minor,currency,due_day,payment_method,starts_on,ends_on,active,notes,created_at", key: "id", order: "name", search: "name", path: "/finanzas/egresos", description: "Gastos fijos." },
  pagos_gastos_fijos: { table: "fixed_expense_payments", columns: "id,fixed_expense_id,month,amount_minor,paid_on,created_at", key: "id", order: "paid_on", date: "paid_on", path: "/finanzas/egresos", description: "Pagos registrados de gastos fijos." },
  categorias_gastos: { table: "expense_categories", columns: "id,name,kind,active", key: "id", order: "name", search: "name", path: "/inventario/compras", description: "Categorías de compras y egresos." },
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
  compras: { estado: "status" },
};
const pageSchema = z.number().int().min(0).max(200).default(1).describe("Primera página: 1. Usar siguiente_pagina para continuar. 0 se acepta como alias de 1.");
const readOnly = { readOnlyHint: true, openWorldHint: false, destructiveHint: false };
const writerId = "5afbc94d-aecf-44e8-b12e-e136f49abb62"; // Richard Ortiz's Gestión account.
const expenseColumns = "id,purchased_on,description,category,amount_minor,currency,status,paid_on,supplier,payment_method,notes";
const expenseInput = z.object({
  clave_movimiento: z.string().trim().min(8).max(120).describe("Clave estable de esta transacción bancaria o UUID. Reutilizarla al reintentar; no incluir número de cuenta completo."),
  fecha: z.iso.date().describe("Fecha del gasto, AAAA-MM-DD."),
  descripcion: z.string().trim().min(1).max(200),
  categoria: z.string().trim().min(1).max(60).describe("Nombre exacto de una categoría activa de Compras; consultar listar_opciones_gastos antes."),
  importe: z.string().describe("Importe positivo sin símbolo ni separadores de miles; máximo dos decimales, por ejemplo 7982.00."),
  moneda: z.enum(["UYU", "USD"]),
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
        version: "1.3.0",
      });

      server.registerTool("quien_soy", {
        title: "Cuenta conectada",
        description: "Comprueba qué cuenta de Gestión está conectada y si puede registrar gastos o productos en borrador.",
        inputSchema: z.object({}), annotations: readOnly,
      }, async () => result({ nombre: member.display_name, perfil: "propietario", solo_lectura: !canWrite, puede_registrar_gastos: canWrite, puede_registrar_productos: canWrite }));

      server.registerTool("listar_fuentes", {
        title: "Fuentes disponibles",
        description: "Enumera las fuentes de Gestión que se pueden consultar. Úsala antes de elegir una fuente.",
        inputSchema: z.object({}), annotations: readOnly,
      }, async () => result({ primera_pagina: 1, importes: "Los campos _minor son centésimos; no mezclar monedas ni sumar fuentes que representan los mismos pedidos. Para totales de ventas de local/feria/redes usar resumir_ventas_locales.", fuentes: Object.entries(datasets).map(([name, entry]) => { const dataset: Dataset = entry; return { nombre: name, descripcion: dataset.description, pagina: `https://matearte-gestion.vercel.app${dataset.path}`, campo_busqueda: dataset.search ?? null, campo_fecha: dataset.date ?? null, filtros_exactos: Object.keys(filters[name as keyof typeof datasets] ?? {}) }; }) }));

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
          return result({ detalle: outcome, registrados: outcome.filter((entry) => entry.estado === "registrado").length, ya_registrados: outcome.filter((entry) => entry.estado === "ya_registrado").length, pagina: "https://matearte-gestion.vercel.app/inventario/compras" });
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
          referencia: z.string().min(1).max(120).optional(),
          categoria: z.string().min(1).max(120).optional(),
          sku: z.string().min(1).max(120).optional(),
        }), annotations: readOnly,
      }, async ({ fuente, id, buscar, desde, hasta, limite, pagina: requestedPage, ...exactFilters }) => {
        const pagina = pageNumber(requestedPage);
        const dataset = datasets[fuente] as Dataset;
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
            let query = supabase.from("local_sales").select("id,channel,currency,total_minor,deposit_minor,payment_method", { count: "exact" })
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
