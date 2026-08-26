import { randomUUID } from "node:crypto";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { apiError, apiOk, readJson } from "@/lib/api";
import { readCart } from "@/lib/cart";
import { calculateDesignPriceMinor } from "@/lib/design-pricing";
import { siteUrl } from "@/lib/supabase/config";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);
  try {
    const { data: publicSettings } = await client.from("commerce_settings").select("commerce_enabled,mercado_pago_enabled").eq("singleton", true).single();
    if (!publicSettings?.commerce_enabled || !publicSettings.mercado_pago_enabled) return apiError("El comercio todavía no está habilitado.", 503);
    const body = await readJson(request);
    if (typeof body.shippingRateId !== "string" || !uuid.test(body.shippingRateId)) return apiError("Elegí una modalidad de entrega.");
    const customer = body.customer && typeof body.customer === "object" && !Array.isArray(body.customer) ? body.customer as Record<string, unknown> : {};
    const fullName = typeof customer.fullName === "string" ? customer.fullName.trim().slice(0, 120) : "";
    const phone = typeof customer.phone === "string" ? customer.phone.trim().slice(0, 40) : "";
    const department = typeof customer.department === "string" ? customer.department.trim().slice(0, 80) : "";
    const address = typeof customer.address === "string" ? customer.address.trim().slice(0, 240) : "";
    if (!fullName || !phone) return apiError("Completá nombre y teléfono.");

    const admin = createAdminSupabase();
    await admin.rpc("release_expired_commerce_reservations");
    const cart = await readCart(admin, user.id);
    if (!cart.items.length) return apiError("El carrito está vacío.");
    const designIds = cart.items.filter((item) => item.item_type === "design").map((item) => item.design_id).filter(Boolean) as string[];
    const designPrices: Record<string, number> = {};
    let pricingVersionId: string | null = null;
    if (designIds.length) {
      const [{ data: designs, error: designsError }, { data: catalog, error: catalogError }] = await Promise.all([
        admin.from("designs").select("id,configuration,fleje_configuration").in("id", designIds).eq("user_id", user.id),
        admin.rpc("get_published_pricing_catalog"),
      ]);
      if (designsError || catalogError || !catalog) throw new Error("No se pudo verificar el catálogo de precios.");
      for (const design of designs || []) {
        const priced = calculateDesignPriceMinor(design.configuration, design.fleje_configuration, catalog);
        designPrices[design.id] = priced.priceMinor;
        pricingVersionId = priced.pricingVersionId;
      }
      if (Object.keys(designPrices).length !== designIds.length) throw new Error("No se pudo verificar uno de los diseños.");
    }

    const requestedKey = request.headers.get("idempotency-key") || "";
    const idempotencyKey = uuid.test(requestedKey) ? requestedKey : randomUUID();
    const { data: result, error: orderError } = await admin.rpc("create_checkout_order", {
      p_user_id: user.id,
      p_cart_id: cart.id,
      p_shipping_rate_id: body.shippingRateId,
      p_design_prices: designPrices,
      p_customer_snapshot: { fullName, phone, department, address, email: user.email, pricingVersionId },
      p_idempotency_key: idempotencyKey,
    });
    if (orderError || !result) throw new Error(orderError?.message || "No se pudo crear el pedido.");
    const orderId = String(result.id);
    const { data: order, error: fetchError } = await admin.from("orders").select("id,order_number,items_subtotal_minor,shipping_minor,payment_fee_minor,total_minor,reservation_expires_at,mercado_pago_preference_id").eq("id", orderId).single();
    if (fetchError || !order) throw new Error("No se pudo recuperar el pedido.");

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
    if (!accessToken) throw new Error("Mercado Pago todavía no tiene credenciales configuradas.");
    const preferenceClient = new Preference(new MercadoPagoConfig({ accessToken, options: { timeout: 8_000 } }));
    if (order.mercado_pago_preference_id) {
      const existing = await preferenceClient.get({ preferenceId: order.mercado_pago_preference_id });
      const checkoutUrl = process.env.MERCADO_PAGO_ENV === "sandbox" ? existing.sandbox_init_point : existing.init_point;
      if (checkoutUrl) return apiOk({ orderId, orderNumber: order.order_number, checkoutUrl, existing: true });
    }
    const mpItems = [
      { id: `order-${orderId}`, title: `Pedido MateArte #${order.order_number}`, quantity: 1, unit_price: order.items_subtotal_minor / 100, currency_id: "UYU" },
      ...(order.shipping_minor ? [{ id: `shipping-${orderId}`, title: "Envío", quantity: 1, unit_price: order.shipping_minor / 100, currency_id: "UYU" }] : []),
      ...(order.payment_fee_minor ? [{ id: `fee-${orderId}`, title: "Comisión de Mercado Pago", quantity: 1, unit_price: order.payment_fee_minor / 100, currency_id: "UYU" }] : []),
    ];
    const statusUrl = `${siteUrl()}/pedidos/${orderId}`;
    const preference = await preferenceClient.create({
      body: {
        items: mpItems,
        payer: { email: user.email },
        external_reference: orderId,
        notification_url: `${siteUrl()}/api/webhooks/mercado-pago`,
        back_urls: { success: statusUrl, pending: statusUrl, failure: statusUrl },
        auto_return: "approved",
        expires: true,
        expiration_date_to: order.reservation_expires_at,
        metadata: { order_id: orderId, pricing_version_id: pricingVersionId },
        statement_descriptor: "MATEARTE",
      },
      requestOptions: { idempotencyKey: orderId },
    });
    if (!preference.id) throw new Error("Mercado Pago no devolvió una preferencia.");
    await admin.from("orders").update({ mercado_pago_preference_id: preference.id }).eq("id", orderId);
    const checkoutUrl = process.env.MERCADO_PAGO_ENV === "sandbox" ? preference.sandbox_init_point : preference.init_point;
    if (!checkoutUrl) throw new Error("Mercado Pago no devolvió la URL de pago.");
    return apiOk({ orderId, orderNumber: order.order_number, checkoutUrl, existing: false }, 201);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "No se pudo iniciar el pago.", 400);
  }
}

export const dynamic = "force-dynamic";
