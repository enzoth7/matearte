import { randomUUID } from "node:crypto";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { apiError, apiOk, readJson } from "@/lib/api";
import { readCart } from "@/lib/cart";
import { calculateDesignPriceMinor } from "@/lib/design-pricing";
import { siteUrl } from "@/lib/supabase/config";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";
import { isLocale } from "@/i18n/config";
import { localizeCanonicalPath } from "@/i18n/paths";
import type { Locale } from "@/types/catalog";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type PublishedPricingCatalog = { versionId: string; version: number; rules: Record<string, number> };

export async function POST(request: Request) {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);
  try {
    const { data: publicSettings } = await client.from("commerce_settings").select("commerce_enabled,mercado_pago_enabled,payment_fee_enabled,payment_fee_legal_approval,reservation_minutes").eq("singleton", true).single();
    if (!publicSettings?.commerce_enabled || !publicSettings.mercado_pago_enabled) return apiError("El comercio todavía no está habilitado.", 503);
    const body = await readJson(request);
    const localeValue = typeof body.locale === "string" ? body.locale : null;
    const locale: Locale = isLocale(localeValue) ? localeValue : "es";
    if (typeof body.shippingRateId !== "string" || !uuid.test(body.shippingRateId)) return apiError("Elegí una modalidad de entrega.");
    const customer = body.customer && typeof body.customer === "object" && !Array.isArray(body.customer) ? body.customer as Record<string, unknown> : {};
    const fullName = typeof customer.fullName === "string" ? customer.fullName.trim().slice(0, 120) : "";
    const phone = typeof customer.phone === "string" ? customer.phone.trim().slice(0, 40) : "";
    const department = typeof customer.department === "string" ? customer.department.trim().slice(0, 80) : "";
    const city = typeof customer.city === "string" ? customer.city.trim().slice(0, 100) : "";
    const address = typeof customer.address === "string" ? customer.address.trim().slice(0, 240) : "";
    if (!fullName || !phone) return apiError("Completá nombre y teléfono.");

    const admin = createAdminSupabase();
    const cart = await readCart(admin, user.id);
    if (!cart.items.length) return apiError("El carrito está vacío.");
    const { data: shippingRate, error: shippingError } = await admin
      .from("shipping_rates")
      .select("id,code,name,is_pickup")
      .eq("id", body.shippingRateId)
      .eq("active", true)
      .maybeSingle();
    if (shippingError || !shippingRate) return apiError("La modalidad de entrega no está disponible.");

    const designIds = cart.items.filter((item) => item.item_type === "design").map((item) => item.design_id).filter(Boolean) as string[];
    const designPrices: Record<string, number> = {};
    let pricingVersionId: string | null = null;
    let publishedCatalog: PublishedPricingCatalog | null = null;
    if (designIds.length || (publicSettings.payment_fee_enabled && publicSettings.payment_fee_legal_approval)) {
      const { data: catalog, error: catalogError } = await admin.rpc("get_published_pricing_catalog");
      if (catalogError || !catalog || typeof catalog !== "object") throw new Error("No se pudo verificar el catálogo de precios.");
      publishedCatalog = catalog as unknown as PublishedPricingCatalog;
    }
    if (designIds.length && publishedCatalog) {
      const { data: designs, error: designsError } = await admin
        .from("designs")
        .select("id,configuration,fleje_configuration")
        .in("id", designIds)
        .eq("user_id", user.id);
      if (designsError) throw new Error("No se pudo verificar el catálogo de precios.");
      for (const design of designs || []) {
        const priced = calculateDesignPriceMinor(design.configuration, design.fleje_configuration, publishedCatalog);
        designPrices[design.id] = priced.priceMinor;
        pricingVersionId = priced.pricingVersionId;
      }
      if (Object.keys(designPrices).length !== designIds.length) throw new Error("No se pudo verificar uno de los diseños.");
    }

    const requestedKey = request.headers.get("idempotency-key") || "";
    const idempotencyKey = uuid.test(requestedKey) ? requestedKey : randomUUID();
    const checkoutItems = cart.items.map((item) => {
      const variant = item.variant as unknown as { price_minor?: number } | null;
      const sourceId = item.item_type === "design" ? item.design_id : item.variant_id;
      const unitPriceMinor = item.item_type === "design"
        ? designPrices[String(item.design_id)]
        : Number(variant?.price_minor);
      if (!sourceId || !Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) throw new Error("No se pudo verificar uno de los artículos.");
      return { itemType: item.item_type, sourceId: String(sourceId), quantity: Number(item.quantity), unitPriceMinor };
    });
    const itemsSubtotalMinor = checkoutItems.reduce((total, item) => total + item.unitPriceMinor * item.quantity, 0);
    const feePercent = publicSettings.payment_fee_enabled && publicSettings.payment_fee_legal_approval
      ? Number(publishedCatalog?.rules?.["commission:mercado_pago"])
      : 0;
    if (!Number.isFinite(feePercent) || feePercent < 0) throw new Error("La regla de comisión no está publicada.");
    const paymentFeeMinor = Math.round(itemsSubtotalMinor * feePercent / 100);
    const totalMinor = itemsSubtotalMinor + paymentFeeMinor;
    const reservationExpiresAt = new Date(Date.now() + Number(publicSettings.reservation_minutes || 30) * 60_000).toISOString();
    const checkoutPayload = {
      version: 1,
      userId: user.id,
      cartId: cart.id,
      shippingRateId: shippingRate.id,
      customer: { fullName, phone, department, city, address, email: user.email, pricingVersionId },
      items: checkoutItems,
      paymentFeeMinor,
    };

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
    if (!accessToken) throw new Error("Mercado Pago todavía no tiene credenciales configuradas.");
    const preferenceClient = new Preference(new MercadoPagoConfig({ accessToken, options: { timeout: 8_000 } }));
    const labels = {
      es: { order: "Pedido MateArte", fee: "Comisión de Mercado Pago" },
      en: { order: "MateArte order", fee: "Mercado Pago fee" },
      pt: { order: "Pedido MateArte", fee: "Tarifa do Mercado Pago" },
    }[locale];
    const mpItems = [
      { id: `checkout-${idempotencyKey}`, title: labels.order, quantity: 1, unit_price: itemsSubtotalMinor / 100, currency_id: "UYU" },
      ...(paymentFeeMinor ? [{ id: `fee-${idempotencyKey}`, title: labels.fee, quantity: 1, unit_price: paymentFeeMinor / 100, currency_id: "UYU" }] : []),
    ];
    const statusUrl = `${siteUrl()}${localizeCanonicalPath(`/pedidos/${idempotencyKey}`, locale)}`;
    const preference = await preferenceClient.create({
      body: {
        items: mpItems,
        payer: { email: user.email },
        external_reference: idempotencyKey,
        notification_url: `${siteUrl()}/api/webhooks/mercado-pago`,
        back_urls: {
          success: `${statusUrl}?payment=success`,
          pending: `${statusUrl}?payment=pending`,
          failure: `${statusUrl}?payment=failure`,
        },
        auto_return: "approved",
        expires: true,
        expiration_date_to: reservationExpiresAt,
        metadata: { checkout_payload: JSON.stringify(checkoutPayload), expected_total_minor: totalMinor },
        statement_descriptor: "MATEARTE",
      },
      requestOptions: { idempotencyKey },
    });
    if (!preference.id) throw new Error("Mercado Pago no devolvió una preferencia.");
    const checkoutUrl = process.env.MERCADO_PAGO_ENV === "sandbox" ? preference.sandbox_init_point : preference.init_point;
    if (!checkoutUrl) throw new Error("Mercado Pago no devolvió la URL de pago.");
    return apiOk({ checkoutId: idempotencyKey, checkoutUrl }, 201);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "No se pudo iniciar el pago.", 400);
  }
}

export const dynamic = "force-dynamic";
