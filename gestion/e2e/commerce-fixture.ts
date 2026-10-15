import type { Page } from "@playwright/test";
import { commerceFixture } from "../src/testing/commerce";
export async function mockCommerce(page: Page, options: { denied?: boolean; failure?: boolean; authenticated?: boolean; writable?: boolean; failWrite?: string } = {}) {
  const fixture = commerceFixture();
  const user = { id: "admin-test", aud: "authenticated", role: "authenticated", email: "test@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const session = { access_token: "header.payload.signature", refresh_token: "test-only", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
  await page.addInitScript(({ session, authenticated }) => {
    localStorage.setItem("matearte-gestion-demo-v1", JSON.stringify({ orders: [{ id: "MA-FAKE" }] }));
    if (authenticated) localStorage.setItem("matearte-gestion-commerce-auth", JSON.stringify(session));
  }, { session, authenticated: options.authenticated !== false });
  const writes: { table: string; method: string; body: any }[] = [];
  Object.assign(fixture.products[0], { description: "Cuero y alpaca", category_code: "mates", attributes: {}, catalog_filters: {}, sale_mode: "standard" });
  const tables: Record<string, any> = {
    commerce_admin_users: options.denied ? null : { user_id: user.id }, commerce_products: fixture.products,
    orders: fixture.orders, commerce_payments: fixture.payments, commerce_discounts: fixture.reference.discounts,
    commerce_international_shipping_rates: fixture.reference.shippingRates, commerce_exchange_rates: fixture.reference.exchangeRates,
    commerce_attribute_definitions: [], commerce_attribute_options: [], commerce_category_attributes: [], commerce_bank_transfer_settings: { account_holder: 'Titular', transfer_account: '111', cash_deposit_account: '222', cash_deposit_label: 'Depósito' },
    commerce_categories: fixture.reference.categories, commerce_settings: fixture.reference.settings, shipping_rates: fixture.nationalRates,
    local_sales_customers: [], local_sales: [],
    site_announcements: [],
    products: [], customers: [], order_lines: [], settings: { id: 1, exchange_rate: 0.027 },
  };
  await page.route("https://*.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/auth/v1/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(url.pathname.endsWith("/user") ? user : session) });

    const table = url.pathname.split("/").at(-1)!;
    if (options.failure && table === "orders") return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Lectura interrumpida" }) });
    const method = route.request().method();
    const respond = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (table === 'gestion_customer_profile_details') return respond([{ user_id: 'customer-1', birth_date: '1993-04-05', city: 'Montevideo', country_code: 'UY' }]);
    if (url.pathname.startsWith('/storage/v1/object/public/')) return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X1cAAAAASUVORK5CYII=', 'base64')});
    if (method !== 'GET') {
      if (!options.writable) throw Error('No se permiten escrituras en esta prueba');
      const body = route.request().headers()['content-type']?.includes('json') ? route.request().postDataJSON() : {};
      writes.push({ table, method, body });
      if (options.failWrite === table) return respond({message:'Guardado rechazado'},403);
      if (url.pathname.startsWith('/storage/v1/object/sign/')) return respond({ signedURL: '/object/public/product-images/test.png' });
      if (url.pathname.startsWith('/storage/v1/')) return respond({Key:url.pathname,Id:'stored'});
      if (url.pathname.startsWith('/functions/')) return respond({success:true});
      if (table === 'gestion_update_customer_contact') {
        for (const order of fixture.orders.filter(o => body.order_ids.includes(o.id))) Object.assign(order.customer_snapshot,{fullName:body.contact.name,email:body.contact.email,phone:body.contact.phone});
        return respond(body.order_ids.length);
      }
      if (table === 'create_local_sale_with_items' || table === 'create_channel_sale_with_items') {
        const saleNumber = tables.local_sales.length + 19;
        const channel = table === 'create_channel_sale_with_items' ? body.p_channel : 'Local';
        const prefix = channel === 'Local' ? 'L' : 'R';
        const referenceNumber = tables.local_sales.filter((sale: any) => sale.reference_code?.startsWith(`#${prefix}`)).length + 1;
        const customer = tables.local_sales_customers.find((entry: any) => entry.id === body.p_customer_id);
        const items = body.p_items.map((item: any, index: number) => {
          const product = fixture.products.find((entry) => entry.commerce_variants.some((variant) => variant.id === item.variant_id))!;
          const variant = product.commerce_variants.find((entry) => entry.id === item.variant_id)!;
          return { id: `sale-item-${saleNumber}-${index}`, variant_id: item.variant_id, sku: variant.sku,
            product_name: product.name, variant_name: variant.name, quantity: item.quantity,
            unit_price_minor: item.unit_price_minor, line_total_minor: item.unit_price_minor * item.quantity };
        });
        const itemsTotal = items.reduce((sum: number, item: any) => sum + item.line_total_minor, 0);
        const charged = body.p_payment_method === 'Seña' ? body.p_deposit_minor : itemsTotal;
        const row = { id: `sale-${saleNumber}`, sale_number: saleNumber, reference_code: `#${prefix}${String(referenceNumber).padStart(3, '0')}`, channel, customer_id: body.p_customer_id,
          customer_name: customer?.full_name || 'Cliente sin registrar', sold_on: body.p_sold_on,
          payment_method: body.p_payment_method, total_minor: charged, currency: 'UYU',
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
      let matched = entries.filter(row => row && (!id || String(row.id) === id));
      if (method === 'PATCH') matched.forEach(row => Object.assign(row,body));
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
    let data = tables[table];
    if (data === undefined) throw Error(`Lectura no prevista: ${table}`);
    const id = url.searchParams.get('id')?.replace('eq.','');
    if (Array.isArray(data) && id) data = data.filter((row: any) => row.id === id);
    await route.fulfill({ status: 200, headers: { "Content-Type": "application/json", "Content-Range": Array.isArray(data) ? `0-${Math.max(0,data.length - 1)}/${data.length}` : "0-0/1" }, body: JSON.stringify(data) });
  });
  return { fixture, writes, tables };
}
