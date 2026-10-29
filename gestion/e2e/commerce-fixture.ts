import type { Page } from "@playwright/test";
import { commerceFixture } from "../src/testing/commerce";
import { assemblyName, assemblySummary, mateAssemblyFields } from "../../shared/mate-assembly";
// Los productos mayoristas viven en el catálogo único: las pruebas los cargan en `tables.products` con el formato histórico.
function wholesaleAsCatalog(rows: any[]) {
  return rows.map((row) => ({
    id: `wholesale-${row.id}`, name: row.model, category: row.category_code || 'mates', category_code: row.category_code || 'mates', description: row.description || '',
    attributes: row.catalog_attributes || {}, published: false, editorial_slug: `mayorista-${row.id}`, sale_mode: 'standard', peso: 0,
    commerce_variants: [{ id: String(row.id), sku: row.sku || String(row.id), name: row.variant, price_minor: 0, base_price_minor: Math.round(Number(row.price_uyu || 0) * 100), active: true,
      available_wholesale: row.available_wholesale !== false, wholesale_price_arg: row.price_arg, available_local: row.available_local, available_web: row.available_web,
      rim_type: row.rim_type || '', leather_type: row.leather_type || '', weight_grams: row.weight_grams ?? null, option_values: {} }],
    commerce_product_images: [],
  }));
}

export async function mockCommerce(page: Page, options: { denied?: boolean; failure?: boolean; authenticated?: boolean; writable?: boolean; failWrite?: string; needsSetup?: boolean; accessUserId?: "t1" | "t2" | "t3"; allowedPaths?: string[] | null } = {}) {
  const fixture = commerceFixture();
  const user = { id: "admin-test", aud: "authenticated", role: "authenticated", email: "test@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const session = { access_token: "header.payload.signature", refresh_token: "test-only", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
  await page.addInitScript(({ session, authenticated }) => {
    localStorage.setItem("matearte-gestion-demo-v1", JSON.stringify({ orders: [{ id: "MA-FAKE" }] }));
    if (authenticated) localStorage.setItem("matearte-gestion-commerce-auth", JSON.stringify(session));
  }, { session, authenticated: options.authenticated !== false });
  const writes: { table: string; method: string; body: any }[] = [];
  Object.assign(fixture.products[0], { description: "Cuero y alpaca", category_code: "mates", attributes: { "material-mate": "calabaza", "tipo-virola": "acero", "tipo-cuero": "liso", posamate: "sin-posamate" }, catalog_filters: {}, sale_mode: "standard" });
  fixture.products[0].commerce_variants.forEach((variant) => Object.assign(variant, {
    rim_type: variant.rim_type || "Acero",
    leather_type: variant.leather_type || "Liso",
  }));
  const accessUserId = options.accessUserId ?? "t1";
  const permissionStore: Record<string, string[] | null> = {
    t1: null,
    t2: ['/inicio/resumen', '/comercial/pedidos', '/comercial/registrar-min', '/clientes/base'],
    t3: ['/comercial/pedidos', '/comercial/registrar-may', '/clientes/base', '/productos/catalogo', '/productos/ajustes'],
  };
  if (options.allowedPaths !== undefined) permissionStore[accessUserId] = options.allowedPaths;
  const tables: Record<string, any> = {
    commerce_admin_users: options.denied ? null : { user_id: user.id, display_name: accessUserId === 't1' ? 'Richard Ortiz' : accessUserId === 't2' ? 'Florencia Costa' : 'Florencia Pizzorno', access_user_id: accessUserId, allowed_paths: permissionStore[accessUserId] }, commerce_products: fixture.products,
    orders: fixture.orders, commerce_payments: fixture.payments, commerce_discounts: fixture.reference.discounts,
    commerce_international_shipping_rates: fixture.reference.shippingRates, commerce_exchange_rates: fixture.reference.exchangeRates,
    commerce_attribute_definitions: [], commerce_attribute_options: [], commerce_category_attributes: [], commerce_bank_transfer_settings: { account_holder: 'Titular', transfer_account: '111', cash_deposit_account: '222', cash_deposit_label: 'Depósito' },
    commerce_categories: fixture.reference.categories, commerce_settings: fixture.reference.settings, shipping_rates: fixture.nationalRates, purchases: [], fixed_expenses: [], fixed_expense_payments: [], expense_categories: [],
    local_sales_customers: [], local_sales: [], local_sale_receipts: [], rural_raffle_entries: [],
    site_announcements: [], ad_reports: [], web_leads: [], contact_first_seen: [],
    products: [], wholesale_product_images: [], customers: [], order_lines: [], settings: { id: 1, exchange_rate: 0.027 },
  };
  await page.route("https://*.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/auth/v1/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(url.pathname.endsWith("/user") ? user : session) });

    const table = url.pathname.split("/").at(-1)!;
    if (options.failure && table === "orders") return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Lectura interrumpida" }) });
    const method = route.request().method();
    const respond = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname.endsWith('/functions/v1/gestion-users')) {
      const body = route.request().postDataJSON() || {};
      writes.push({ table: 'gestion-users', method, body });
      if (body.action === 'status') return respond({ needsSetup: Boolean(options.needsSetup) });
      if (body.action === 'bootstrap') return respond({ username: body.username }, 201);
      if (body.action === 'list') return respond({ users: [
        { accessUserId: 't1', username: 'richard', configured: true, allowedPaths: permissionStore.t1 },
        { accessUserId: 't2', username: 'florencia.costa', configured: true, allowedPaths: permissionStore.t2 },
        { accessUserId: 't3', username: 'florencia.pizzorno', configured: true, allowedPaths: permissionStore.t3 },
      ] });
      if (body.action === 'savePermissions') {
        permissionStore[body.accessUserId] = body.allowedPaths;
        return respond({ accessUserId: body.accessUserId, allowedPaths: body.allowedPaths });
      }
      return respond({ user: { accessUserId: body.accessUserId, username: body.username, configured: true } });
    }
    if (table === 'gestion_customer_profile_details' || table === 'gestion_customer_profile_details_full') return respond([{ user_id: 'customer-1', birth_date: '1993-04-05', city: 'Montevideo', country_code: 'UY', company: null, address_line1: null, department: null, postal_code: null }]);
    if (table === 'gestion_next_wholesale_order_code') return respond(`#M${String(tables.order_lines.length + 96).padStart(3, '0')}`);
    if (table === 'gestion_web_leads') return respond(tables.web_leads);
    if (table === 'gestion_contact_origins') return respond([]);
    if (table === 'gestion_customer_first_seen') return respond(tables.contact_first_seen.slice(Number(route.request().postDataJSON()?.p_offset || 0), Number(route.request().postDataJSON()?.p_offset || 0) + Number(route.request().postDataJSON()?.p_limit || 500)));
    if (table === 'get_published_pricing_catalog') return respond({ versionId: 'pricing-test', version: 7, publishedAt: '2026-10-20T12:00:00Z', rules: {
      ...Object.fromEntries(mateAssemblyFields.flatMap(field => field.options.map(option => [option.ruleKey, option.initialPrice]))),
      'leather:raw-posa-mate': 650,
      'customization:laser:rim_text': 120, 'customization:laser:rim_image': 300,
      'customization:bronze-applique:rim_text': 25, 'customization:bronze-applique:rim_image': 350,
      'customization:alpaca-applique:rim_text': 30, 'customization:alpaca-applique:rim_image': 400,
      'customization:bronze-applique:fleje_text': 15, 'customization:bronze-applique:fleje_image': 450,
      'customization:alpaca-applique:fleje_text': 20, 'customization:alpaca-applique:fleje_image': 500,
    } });
    if (url.pathname.startsWith('/storage/v1/object/public/')) return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X1cAAAAASUVORK5CYII=', 'base64')});
    if (url.pathname.endsWith('/functions/v1/marketing-workspace')) {
      const action = String(route.request().postDataJSON()?.action || '');
      if (action === 'registrationTrend') {
        const days = Number(route.request().postDataJSON()?.days || 30);
        return respond({ today: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), days, trend: [] });
      }
      const marketing: Record<string, unknown> = {
        contacts: { contacts: [], count: 0, summary: { total: 0, origins: [] } },
        campaigns: { campaigns: [] },
        settings: { settings: { enabled: false, headline: '', description: '', image_url: null, discount_code: '' } },
        analytics: { site: { id: 'tienda', name: 'Tienda web' }, sites: [{ id: 'tienda', name: 'Tienda web' }], days: 30, timeline: [], countries: [], devices: [], referrers: [], pages: [], products: [] },
      };
      return respond(marketing[action] ?? {});
    }
    if (method !== 'GET' && method !== 'HEAD') {
      if (!options.writable) throw Error('No se permiten escrituras en esta prueba');
      const body = route.request().headers()['content-type']?.includes('json') ? route.request().postDataJSON() : {};
      writes.push({ table, method, body });
      if (options.failWrite === table || (options.failWrite === 'gestion_update_customer_contact' && table === 'gestion_update_customer_all')) return respond({message:'Guardado rechazado'},403);
      if (url.pathname.startsWith('/storage/v1/object/sign/')) return respond({ signedURL: '/object/public/product-images/test.png' });
      if (url.pathname.startsWith('/storage/v1/')) return respond({Key:url.pathname,Id:'stored'});
      if (url.pathname.startsWith('/functions/')) return respond({success:true});
      if (table === 'gestion_update_customer_contact' || table === 'gestion_update_customer_all') {
        for (const order of fixture.orders.filter(o => body.order_ids.includes(o.id))) Object.assign(order.customer_snapshot,{fullName:body.contact.name,email:body.contact.email,phone:body.contact.phone,...body.contact});
        return respond(body.order_ids.length);
      }
      if (table === 'gestion_update_web_lead') {
        const lead = tables.web_leads.find((entry: any) => entry.source_id === body.p_source_id && entry.source_kind === body.p_source_kind);
        if (lead) Object.assign(lead, { full_name: body.p_contact.name, origin_channel: body.p_contact.originChannel, customer_type: body.p_contact.customerType });
        return respond(!!lead);
      }
      if (table === 'gestion_delete_unpurchased_web_lead') {
        const before = tables.web_leads.length;
        tables.web_leads = tables.web_leads.filter((entry: any) => entry.source_id !== body.p_source_id || entry.source_kind !== body.p_source_kind);
        return respond(tables.web_leads.length === before - 1);
      }
      if (table === 'gestion_delete_unlinked_contact') {
        const local = tables.local_sales_customers.find((entry: any) => entry.id === body.p_local_id);
        const raffle = tables.rural_raffle_entries.find((entry: any) => entry.id === body.p_raffle_id);
        if (local && tables.local_sales.some((sale: any) => sale.customer_id === local.id)) return respond({ message: 'Tiene ventas vinculadas' }, 400);
        tables.local_sales_customers = tables.local_sales_customers.filter((entry: any) => entry.id !== body.p_local_id);
        tables.rural_raffle_entries = tables.rural_raffle_entries.filter((entry: any) => entry.id !== body.p_raffle_id);
        return respond(Number(!!local) + Number(!!raffle));
      }
      if (table === 'gestion_record_local_sale_payment') {
        const existing = tables.local_sale_receipts.find((entry: any) => entry.id === body.p_receipt_id);
        if (existing) return respond(existing);
        const sale = tables.local_sales.find((entry: any) => entry.id === body.p_sale_id);
        if (!sale) return respond({ message: 'La venta no existe' }, 400);
        const total = sale.local_sale_items.reduce((sum: number, item: any) => sum + item.line_total_minor, 0);
        const laterPaid = tables.local_sale_receipts.filter((entry: any) => entry.sale_id === sale.id)
          .reduce((sum: number, entry: any) => sum + entry.amount_minor, 0);
        if (body.p_amount_minor <= 0 || body.p_amount_minor > total - sale.total_minor - laterPaid) return respond({ message: 'El cobro supera el saldo pendiente' }, 400);
        const receipt = { id: body.p_receipt_id, sale_id: sale.id, amount_minor: body.p_amount_minor,
          payment_method: body.p_payment_method, paid_on: body.p_paid_on, created_at: new Date().toISOString() };
        tables.local_sale_receipts.push(receipt);
        return respond(receipt);
      }
      if (table === 'gestion_update_local_sale') {
        const sale = tables.local_sales.find((entry: any) => entry.id === body.p_sale_id);
        if (!sale) return respond({ message: 'La venta no existe' }, 400);
        const items = [];
        for (const [index, line] of body.p_items.entries()) {
          const existing = line.id && sale.local_sale_items.find((entry: any) => entry.id === line.id);
          const product = line.id ? undefined : fixture.products.find(entry => entry.commerce_variants.some(variant => variant.sku.toUpperCase() === String(line.sku).toUpperCase()));
          const variant = product?.commerce_variants.find(entry => entry.sku.toUpperCase() === String(line.sku).toUpperCase());
          if (!existing && !variant) return respond({ message: 'El SKU no está disponible para ventas del local' }, 400);
          items.push({ ...(existing || { id: `added-item-${index}`, variant_id: variant!.id, sku: variant!.sku,
            product_name: product!.name, variant_name: variant!.name }), quantity: line.quantity,
            unit_price_minor: line.unit_price_minor, line_total_minor: line.quantity * line.unit_price_minor });
        }
        sale.local_sale_items = items;
        sale.sold_on = body.p_sold_on;
        sale.payment_method = body.p_payment_method;
        sale.deposit_minor = body.p_deposit_minor;
        const itemsTotal = items.reduce((sum: number, item: any) => sum + item.line_total_minor, 0);
        sale.total_minor = body.p_deposit_minor ?? itemsTotal;
        return respond({ id: sale.id, items_total_minor: itemsTotal, charged_total_minor: sale.total_minor });
      }
      if (table === 'create_local_sale_with_items' || table === 'create_channel_sale_with_items' || table === 'gestion_create_local_sale_with_items') {
        const saleNumber = tables.local_sales.length + 19;
        const channel = table === 'create_local_sale_with_items' ? 'Local' : body.p_channel;
        const prefix = channel === 'Local' ? 'L' : channel === 'Feria' ? 'F' : 'R';
        const referenceNumber = tables.local_sales.filter((sale: any) => sale.reference_code?.startsWith(`#${prefix}`)).length + 1;
        const customer = tables.local_sales_customers.find((entry: any) => entry.id === body.p_customer_id);
        const items = body.p_items.map((item: any, index: number) => {
          if (item.item_kind === 'custom_mate') return { id: `sale-item-${saleNumber}-${index}`, variant_id: null, sku: '', product_name: assemblyName(item.customization.assembly.selections), variant_name: assemblySummary(item.customization.assembly.selections), quantity: item.quantity, unit_price_minor: item.unit_price_minor, line_total_minor: item.unit_price_minor * item.quantity, customization: item.customization };
          const product = fixture.products.find((entry) => entry.commerce_variants.some((variant) => variant.id === item.variant_id))!;
          const variant = product.commerce_variants.find((entry) => entry.id === item.variant_id)!;
          return { id: `sale-item-${saleNumber}-${index}`, variant_id: item.variant_id, sku: variant.sku,
            product_name: product.name, variant_name: variant.name, quantity: item.quantity,
            unit_price_minor: item.unit_price_minor, line_total_minor: item.unit_price_minor * item.quantity, customization: item.customization || null };
        });
        const itemsTotal = items.reduce((sum: number, item: any) => sum + item.line_total_minor, 0);
        const charged = body.p_deposit_minor == null ? itemsTotal : body.p_deposit_minor;
        const row = { id: `sale-${saleNumber}`, sale_number: saleNumber, reference_code: `#${prefix}${String(referenceNumber).padStart(3, '0')}`, channel, customer_id: body.p_customer_id,
          customer_name: customer?.full_name || 'Cliente sin registrar', sold_on: body.p_sold_on,
          payment_method: body.p_payment_method, total_minor: charged, deposit_minor: body.p_deposit_minor, currency: 'UYU',
          created_at: new Date().toISOString(), local_sale_items: items };
        tables.local_sales.push(row);
        if (customer) {
          customer.first_purchase_date ||= body.p_sold_on;
          customer.last_purchase_date = body.p_sold_on;
        }
        return respond({ id: row.id, sale_number: row.sale_number, reference_code: row.reference_code, created_at: row.created_at,
          items_total_minor: itemsTotal, charged_total_minor: charged });
      }
      let entries: any[] = table === 'commerce_variants' ? fixture.products.flatMap(p=>p.commerce_variants)
        : table === 'commerce_product_images' ? fixture.products.flatMap(p=>p.commerce_product_images)
        : table === 'order_items' ? fixture.orders.flatMap(o=>o.order_items)
        : Array.isArray(tables[table]) ? tables[table] : [tables[table]];
      const id = url.searchParams.get('id')?.replace('eq.','');
      const fullName = url.searchParams.get('full_name')?.replace('eq.','');
      let matched = entries.filter(row => row && (!id || String(row.id) === id) && (!fullName || String(row.full_name) === fullName));
      if (method === 'PATCH') matched.forEach(row => Object.assign(row,body));
      if (method === 'DELETE' && Array.isArray(tables[table])) matched.forEach(row => {
        const index = tables[table].indexOf(row);
        if (index >= 0) tables[table].splice(index, 1);
      });
      if (method === 'POST') {
        const values = Array.isArray(body) ? body : [body];
        matched = values.map(value => {
          const conflict = table === 'commerce_exchange_rates' ? 'currency_code' : table === 'commerce_international_shipping_rates' ? 'row_order' : 'id';
          const existing = entries.find(row=>row?.[conflict] === value[conflict] && value[conflict] !== undefined);
          if(existing) { Object.assign(existing,value); return existing; }
          const row = {id: `${table}-${writes.length}-${entries.length}`, ...value};
          if(table === 'commerce_product_images') fixture.products.find(p=>p.id === row.product_id)!.commerce_product_images.push(row);
          else if(table === 'commerce_variants') fixture.products.find(p=>p.id === row.product_id)!.commerce_variants.push(row);
          else if(table === 'commerce_products') { Object.assign(row,{commerce_variants:[],commerce_product_images:[]}); fixture.products.push(row); }
          else if(Array.isArray(tables[table])) tables[table].push(row);
          return row;
        });
      }
      return respond(route.request().headers().accept?.includes('object') ? matched[0] : matched);
    }
    let data = table === 'commerce_products' ? [...fixture.products, ...wholesaleAsCatalog(tables.products)] : tables[table];
    if (data === undefined) throw Error(`Lectura no prevista: ${table}`);
    const ids = url.searchParams.get('id')?.match(/^in\.\((.*)\)$/)?.[1].split(',').map((value) => value.replace(/^"|"$/g, ''));
    const id = url.searchParams.get('id')?.replace('eq.','');
    if (Array.isArray(data) && id && !ids) data = data.filter((row: any) => row.id === id);
    if (Array.isArray(data) && ids) data = data.filter((row: any) => ids.includes(String(row.id)));
    const customerName = url.searchParams.get('customer')?.replace('eq.','');
    if (Array.isArray(data) && customerName) data = data.filter((row: any) => row.customer === customerName);
    if (method === 'HEAD') return route.fulfill({ status: 200, headers: { 'Content-Range': `0-0/${Array.isArray(data) ? data.length : 0}`, 'Access-Control-Expose-Headers': 'Content-Range' }, body: '' });
    if (table === 'local_sales_customers' && Array.isArray(data)) {
      const linkedCustomerId = url.searchParams.get('linked_customer_id')?.replace('eq.', '');
      if (linkedCustomerId) data = data.filter((row: any) => row.linked_customer_id === linkedCustomerId);
      const updatedAfter = url.searchParams.get('updated_at')?.replace('gt.', '');
      if (updatedAfter) data = data.filter((row: any) => row.updated_at && row.updated_at > updatedAfter);
      const count = data.length;
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Number(url.searchParams.get('limit') || count);
      data = data.slice(offset, offset + limit);
      return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': `${offset}-${Math.max(offset, offset + data.length - 1)}/${count}`, 'Access-Control-Expose-Headers': 'Content-Range' }, body: JSON.stringify(data) });
    }
    await route.fulfill({ status: 200, headers: { "Content-Type": "application/json", "Content-Range": Array.isArray(data) ? `0-${Math.max(0,data.length - 1)}/${data.length}` : "0-0/1" }, body: JSON.stringify(data) });
  });
  return { fixture, writes, tables };
}
