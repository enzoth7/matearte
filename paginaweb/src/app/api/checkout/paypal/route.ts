import { randomUUID } from "node:crypto";
import { apiError, apiOk, readJson } from "@/lib/api";
import { readCart } from "@/lib/cart";
import { calculateDesignPriceMinor } from "@/lib/design-pricing";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";
import { applyWholesaleMateDiscount, isWholesaleMateEligible, type WholesaleDiscountSettings } from "@/lib/wholesale-pricing";
import { discountErrorMessage, discountReasonFromError, normalizeDiscountCode } from "@/lib/discounts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";

export async function POST(request: Request) {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);

  try {
    const { data: settings } = await client
      .from("commerce_settings")
      .select("commerce_enabled,paypal_enabled,wholesale_mate_discount_enabled,wholesale_mate_quantity_threshold,wholesale_mate_discount_percent")
      .eq("singleton", true)
      .single();
    if (!settings?.commerce_enabled || !settings?.paypal_enabled) return apiError("PayPal no está habilitado.", 503);

    const body = await readJson(request);
    const discountCode = normalizeDiscountCode(body.discountCode);
    const customer = body.customer && typeof body.customer === "object" && !Array.isArray(body.customer)
      ? body.customer as Record<string, unknown>
      : {};
    const destination = body.destination && typeof body.destination === "object" && !Array.isArray(body.destination)
      ? body.destination as Record<string, unknown>
      : {};

    const fullName = text(customer.fullName, 120);
    const phone = text(customer.phone, 40);
    const country = text(destination.country, 100);
    const department = text(destination.department, 80);
    const city = text(destination.city, 100);
    const address = text(destination.address, 240);
    if (!fullName || !phone) return apiError("Completá nombre y teléfono.");
    if (!country) return apiError("Ingresá el país de destino.");

    const admin = createAdminSupabase();
    const cart = await readCart(admin, user.id);
    if (!cart.items.length) return apiError("El carrito está vacío.");

    const designIds = cart.items
      .filter((item) => item.item_type === "design")
      .map((item) => item.design_id)
      .filter(Boolean) as string[];
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

    // Calculate UYU subtotal and total weight from cart items (server-side recalculation)
    const checkoutItemsBeforeWholesale = cart.items.map((item) => {
      const variant = item.variant as unknown as { base_price_minor?: number; price_minor?: number; product?: { peso?: number; category?: string; category_code?: string | null } } | null;
      const unitPriceMinor = item.item_type === "design"
        ? designPrices[String(item.design_id)]
        : Number(variant?.price_minor);
      if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) throw new Error("No se pudo verificar uno de los artículos.");
      return {
        unitPriceMinor,
        baseUnitPriceMinor: item.item_type === "catalog" ? Number(variant?.base_price_minor ?? unitPriceMinor) : unitPriceMinor,
        quantity: Number(item.quantity) || 1,
        peso: item.item_type === "design" ? 200 : (Number(variant?.product?.peso) || 0),
        itemType: item.item_type,
        category: variant?.product?.category_code || variant?.product?.category || null,
      };
    });
    if (isWholesaleMateEligible(checkoutItemsBeforeWholesale, settings as WholesaleDiscountSettings)) {
      return apiError("Los pedidos mayoristas se completan en Uruguay mediante transferencia bancaria.", 409);
    }
    const adjustedPrices = applyWholesaleMateDiscount(checkoutItemsBeforeWholesale, settings as WholesaleDiscountSettings);
    const checkoutItems = checkoutItemsBeforeWholesale.map((item,index) => ({ ...item, unitPriceMinor: adjustedPrices[index].unitPriceMinor }));
    const totalWeightGrams = checkoutItems.reduce((total, item) => total + item.peso * item.quantity, 0);

    // Fetch exchange rates and international shipping rates in parallel
    const [{ data: rates }, { data: intlRatesData }] = await Promise.all([
      admin.from("commerce_exchange_rates").select("currency_code, rate_to_uyu").eq("currency_code", "USD").single(),
      admin.from("commerce_international_shipping_rates").select("*").order("row_order", { ascending: true }),
    ]);
    const usdRate = rates?.rate_to_uyu || 41;

    const intlRates = (intlRatesData && intlRatesData.length > 0)
      ? (intlRatesData as import("@/lib/international-shipping").InternationalShippingRow[])
      : (await import("@/lib/international-shipping")).DEFAULT_INTERNATIONAL_SHIPPING_RATES;

    const { getInternationalShippingRate } = await import("@/lib/international-shipping");
    const shippingCalc = getInternationalShippingRate(totalWeightGrams, country, intlRates);
    const shippingMinor = shippingCalc ? Math.round(shippingCalc.rate * 100) : 0;
    const requestedKey = request.headers.get("idempotency-key") || "";
    const idempotencyKey = uuid.test(requestedKey) ? requestedKey : randomUUID();

    const { data: result, error: orderError } = await admin.rpc("create_paypal_international_order", {
      p_user_id: user.id,
      p_cart_id: cart.id,
      p_design_prices: designPrices,
      p_customer_snapshot: { fullName, phone, email: user.email, pricingVersionId },
      p_destination_snapshot: { country, department, city, address },
      p_idempotency_key: idempotencyKey,
      p_shipping_minor: shippingMinor,
      p_peso: totalWeightGrams,
      p_discount_code: discountCode || null,
      p_usd_rate: usdRate,
    });
    if (orderError || !result) throw new Error(orderError?.message || "No se pudo crear la solicitud internacional.");
    const authoritativeTotalMinor = Number(result.totalMinor);
    const authoritativeShippingMinor = Number(result.shippingMinor);
    if (!Number.isSafeInteger(authoritativeTotalMinor) || !Number.isSafeInteger(authoritativeShippingMinor)) {
      throw new Error("No se pudo verificar el total de la compra.");
    }
    const authoritativeItemsSubtotalMinor = Number(result.itemsSubtotalMinor);
    if (!Number.isSafeInteger(authoritativeItemsSubtotalMinor) || authoritativeItemsSubtotalMinor <= 0) {
      throw new Error("No se pudo verificar el subtotal de la compra.");
    }
    const authoritativeAmountUsdMinor = Number(result.paypalAmountUsdMinor);
    if (!Number.isSafeInteger(authoritativeAmountUsdMinor) || authoritativeAmountUsdMinor <= 0) {
      throw new Error("No se pudo verificar el total en dólares.");
    }

    return apiOk({
      orderId: String(result.id),
      orderNumber: result.orderNumber,
      checkoutId: idempotencyKey,
      amountUsd: (authoritativeAmountUsdMinor / 100).toFixed(2),
      shippingMinor: authoritativeShippingMinor,
      itemsSubtotalMinor: authoritativeItemsSubtotalMinor,
      discountMinor: Number(result.discountMinor || 0),
      totalMinor: authoritativeTotalMinor,
    }, 201);
  } catch (error) {
    const discountReason = discountReasonFromError(error);
    if (discountReason !== "invalid") {
      return apiError(discountErrorMessage(discountReason), 422, { reason: discountReason });
    }
    return apiError(error instanceof Error ? error.message : "No se pudo iniciar el pago.", 400);
  }
}

export const dynamic = "force-dynamic";
