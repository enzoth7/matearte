import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.3.1";
import { pipeline } from "npm:@supabase/middleware@1.0.0";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1.9.2";
import { z } from "npm:zod@4.6.7";

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
};

// Explicit columns keep payment payloads, auth data and other hidden fields out of MCP results.
const datasets = {
  pedidos_web: { table: "orders", columns: "id,order_number,reference_code,status,channel,currency,total_minor,shipping_minor,discount_minor,paid_at,created_at,customer_snapshot,shipping_snapshot,shipping_method,shipping_carrier,tracking_code", key: "id", order: "created_at", search: "customer_name", date: "created_at", path: "/comercial/pedidos", description: "Pedidos web, envíos, estados e importes; excluye canales internos para evitar duplicados.", webOrdersOnly: true },
  articulos_web: { table: "order_items", columns: "id,order_id,title,sku,quantity,unit_price_minor,total_minor,item_type,immutable_snapshot,requires_review,review_status,production_status,completed_at,created_at", key: "id", order: "created_at", search: "title", date: "created_at", path: "/produccion/resumen", description: "Artículos de pedidos web, personalización y producción." },
  ventas_locales: { table: "local_sales", columns: "id,sale_number,reference_code,channel,customer_id,customer_name,sold_on,payment_method,total_minor,deposit_minor,currency,created_at", key: "id", order: "sold_on", search: "customer_name", date: "sold_on", path: "/comercial/pedidos", description: "Ventas de local, feria y redes." },
  articulos_locales: { table: "local_sale_items", columns: "id,sale_id,variant_id,sku,product_name,variant_name,quantity,unit_price_minor,line_total_minor,customization,production_status,production_notes,created_at", key: "id", order: "created_at", search: "product_name", date: "created_at", path: "/produccion/resumen", description: "Artículos vendidos por canales internos y su personalización." },
  cobros_locales: { table: "local_sale_receipts", columns: "id,sale_id,amount_minor,payment_method,paid_on,created_at", key: "id", order: "paid_on", date: "paid_on", path: "/finanzas/cobros", description: "Cobros de ventas locales." },
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
  descuentos: { table: "commerce_discounts", columns: "id,code,discount_type,value,valid_from,valid_until,enabled,applicability,redemption_limit,welcome_only", key: "id", order: "code", search: "code", path: "/marketing/descuentos", description: "Descuentos y promociones." },
  categorias_catalogo: { table: "commerce_categories", columns: "code,label_es,parent_code,active,sort_order", key: "code", order: "sort_order", search: "label_es", path: "/productos/categorias", description: "Categorías del catálogo." },
  avisos: { table: "site_announcements", columns: "id,image_path,alt_text,valid_from,valid_until,enabled,created_at", key: "id", order: "created_at", date: "created_at", path: "/marketing/avisos", description: "Avisos del sitio." },
  usuarios: { table: "commerce_admin_users", columns: "user_id,display_name,active,access_user_id,allowed_paths", key: "user_id", order: "display_name", search: "display_name", path: "/administracion/usuarios", description: "Usuarios y permisos de Gestión." },
  canales: { table: "commerce_settings", columns: "singleton,commerce_enabled,mercado_pago_enabled,paypal_enabled,catalog_price_adjustment_enabled,catalog_price_adjustment_percent,wholesale_mate_discount_enabled,wholesale_mate_quantity_threshold,wholesale_mate_discount_percent,wholesale_discount_categories,updated_at", key: "singleton", order: "singleton", path: "/administracion/canales", description: "Configuración comercial y medios de pago habilitados." },
  cuentas_transferencia: { table: "commerce_bank_transfer_settings", columns: "singleton,account_holder,transfer_account,cash_deposit_account,cash_deposit_label,updated_at", key: "singleton", order: "singleton", path: "/administracion/canales", description: "Datos de transferencia mostrados en Gestión." },
} satisfies Record<string, Dataset>;

const datasetNames = Object.keys(datasets) as [keyof typeof datasets, ...(keyof typeof datasets)[]];
const readOnly = { readOnlyHint: true, openWorldHint: false, destructiveHint: false };
const result = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
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
  async (request, { supabase, userClaims }) => {
    // RLS applies to every query; the membership check is a second, server-side gate.
    const { data: member, error: memberError } = await supabase.from("commerce_admin_users")
      .select("user_id,display_name,active,access_user_id")
      .eq("user_id", userClaims?.id ?? "")
      .eq("active", true)
      .maybeSingle();
    if (memberError || !member || member.access_user_id !== "t1") {
      return Response.json({ error: "Solo las cuentas propietarias de Gestión pueden consultar este MCP." }, { status: 403 });
    }

    const handler = createMcpHandler(() => {
      const server = new McpServer({
        name: "matearte-gestion-lectura",
        version: "1.0.0",
      });

      server.registerTool("quien_soy", {
        title: "Cuenta conectada",
        description: "Comprueba qué cuenta de Gestión está conectada y si puede consultar datos.",
        inputSchema: z.object({}), annotations: readOnly,
      }, async () => result({ nombre: member.display_name, perfil: "propietario", solo_lectura: true }));

      server.registerTool("listar_fuentes", {
        title: "Fuentes disponibles",
        description: "Enumera las fuentes de Gestión que se pueden consultar. Úsala antes de elegir una fuente.",
        inputSchema: z.object({}), annotations: readOnly,
      }, async () => result(Object.entries(datasets).map(([name, entry]) => { const dataset: Dataset = entry; return { nombre: name, descripcion: dataset.description, pagina: `https://matearte-gestion.vercel.app${dataset.path}`, admite_busqueda: !!dataset.search, admite_fechas: !!dataset.date }; })));

      server.registerTool("consultar_registros", {
        title: "Consultar registros de Gestión",
        description: "Lee una página de una fuente permitida. Permite buscar por nombre o código, filtrar por fecha o buscar un identificador exacto. En catálogo y variantes incluye imagen_principal_url de la foto actual de Gestión; usá esa URL al mostrar una foto. Los importes con sufijo _minor están en centésimos. No modifica datos.",
        inputSchema: z.object({
          fuente: z.enum(datasetNames),
          id: z.string().min(1).max(120).optional(),
          buscar: z.string().min(1).max(100).optional(),
          desde: z.iso.date().optional(),
          hasta: z.iso.date().optional(),
          limite: z.number().int().min(1).max(50).default(20),
          pagina: z.number().int().min(0).max(200).default(0),
        }), annotations: readOnly,
      }, async ({ fuente, id, buscar, desde, hasta, limite, pagina }) => {
        const dataset = datasets[fuente] as Dataset;
        if (buscar && !dataset.search) return result({ error: "Esta fuente no admite búsqueda de texto." });
        if ((desde || hasta) && !dataset.date) return result({ error: "Esta fuente no admite fechas." });
        if (desde && hasta && desde > hasta) return result({ error: "El inicio debe ser anterior al fin." });
        let query = supabase.from(dataset.table).select(dataset.columns, { count: "exact" });
        if (dataset.webOrdersOnly) query = query.not("channel", "in", "(Mayorista,Local,Feria,WhatsApp,Instagram,Facebook)");
        if (id) query = query.eq(dataset.key, id);
        if (buscar && dataset.search) {
          const safe = buscar.trim().replace(/[^\p{L}\p{N}\s.@-]/gu, "").slice(0, 100);
          if (!safe) return result({ error: "Ingresá un texto de búsqueda válido." });
          query = query.ilike(dataset.search, `%${safe}%`);
        }
        const timestamp = dataset.date?.endsWith("_at");
        if (desde && dataset.date) query = query.gte(dataset.date, timestamp ? `${desde}T03:00:00Z` : desde);
        if (hasta && dataset.date) {
          const nextDay = new Date(`${hasta}T00:00:00Z`);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          query = timestamp ? query.lt(dataset.date, `${nextDay.toISOString().slice(0, 10)}T03:00:00Z`) : query.lte(dataset.date, hasta);
        }
        const start = pagina * limite;
        const { data, count, error } = await query.order(dataset.order, { ascending: false }).range(start, start + limite - 1);
        if (error) return result({ fuente, error: "No se pudo leer esta fuente con los permisos de la cuenta." });
        let registros = (data ?? []) as unknown as CatalogRecord[];
        if (fuente === "imagenes_catalogo") {
          registros = registros.map((image) => ({ ...image, imagen_url: supabase.storage.from("product-images").getPublicUrl(image.storage_path!).data.publicUrl }));
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
              return { ...row, imagen_principal_url: cover ? supabase.storage.from("product-images").getPublicUrl(cover.storage_path).data.publicUrl : null };
            });
          }
        }
        return result({ fuente, pagina, limite, total: count ?? 0, siguiente_pagina: count != null && start + registros.length < count ? pagina + 1 : null, registros });
      });

      server.registerTool("consultar_clientes_web", {
        title: "Consultar clientes web",
        description: "Lee perfiles de clientes registrados o consultas web, como en la base de clientes de Gestión.",
        inputSchema: z.object({
          tipo: z.enum(["perfiles", "consultas"]),
          pagina: z.number().int().min(0).max(200).default(0),
        }), annotations: readOnly,
      }, async ({ tipo, pagina }) => {
        const name = tipo === "perfiles" ? "gestion_customer_profile_details_full" : "gestion_web_leads";
        const { data, error } = await supabase.rpc(name, { p_offset: pagina * 50, p_limit: 50 });
        if (error) return result({ tipo, error: "No se pudieron leer los clientes web." });
        return result({ tipo, pagina, siguiente_pagina: (data?.length ?? 0) === 50 ? pagina + 1 : null, registros: data ?? [] });
      });

      server.registerTool("consultar_marketing", {
        title: "Consultar Marketing",
        description: "Lee contactos, campañas, métricas, suscripción o Analytics usando las mismas lecturas autenticadas de Gestión.",
        inputSchema: z.object({
          consulta: z.enum(["contacts", "campaigns", "metrics", "settings", "analytics"]),
          pagina: z.number().int().min(0).max(200).default(0),
          buscar: z.string().max(100).default(""),
          sitio: z.enum(["tienda", "personalizador"]).default("tienda"),
          dias: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]).default(30),
        }), annotations: readOnly,
      }, async ({ consulta, pagina, buscar, sitio, dias }) => {
        const { data, error } = await supabase.functions.invoke("marketing-workspace", {
          body: { action: consulta, page: pagina, query: buscar, site: sitio, days: dias },
        });
        if (error || data?.error) return result({ consulta, error: data?.error || "No se pudo consultar Marketing." });
        return result({ consulta, datos: data });
      });
      return server;
    });
    return handler.fetch(request);
  },
));
