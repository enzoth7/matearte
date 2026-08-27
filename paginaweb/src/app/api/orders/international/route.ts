import { randomUUID } from "node:crypto";
import { apiError, apiOk, readJson } from "@/lib/api";
import { readCart } from "@/lib/cart";
import { calculateDesignPriceMinor } from "@/lib/design-pricing";
import { whatsappNumber } from "@/lib/supabase/config";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const money = (minor: number) => new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 }).format(minor / 100);
const text = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";

export async function POST(request: Request) {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);

  try {
    const body = await readJson(request);
    const customer = body.customer && typeof body.customer === "object" && !Array.isArray(body.customer)
      ? body.customer as Record<string, unknown>
      : {};
    const destination = body.destination && typeof body.destination === "object" && !Array.isArray(body.destination)
      ? body.destination as Record<string, unknown>
      : {};

    const fullName = text(customer.fullName, 120);
    const phone = text(customer.phone, 40);
    const country = text(destination.country, 100);
    const city = text(destination.city, 100);
    const address = text(destination.address, 240);
    if (!fullName || !phone) return apiError("Completá nombre y teléfono.");
    if (!country) return apiError("Ingresá el país de destino.");

    const { data: settings } = await client
      .from("commerce_settings")
      .select("commerce_enabled")
      .eq("singleton", true)
      .single();
    if (!settings?.commerce_enabled) return apiError("El comercio todavía no está habilitado.", 503);

    const admin = createAdminSupabase();
    await admin.rpc("release_expired_commerce_reservations");
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

    const requestedKey = request.headers.get("idempotency-key") || "";
    const idempotencyKey = uuid.test(requestedKey) ? requestedKey : randomUUID();
    const { data: result, error: orderError } = await admin.rpc("create_international_order_request", {
      p_user_id: user.id,
      p_cart_id: cart.id,
      p_design_prices: designPrices,
      p_customer_snapshot: { fullName, phone, email: user.email, pricingVersionId },
      p_destination_snapshot: { country, city, address },
      p_idempotency_key: idempotencyKey,
    });
    if (orderError || !result) throw new Error(orderError?.message || "No se pudo crear la solicitud internacional.");

    const orderId = String(result.id);
    const { data: order, error: fetchError } = await admin
      .from("orders")
      .select("order_number,items_subtotal_minor,order_items(title,quantity)")
      .eq("id", orderId)
      .single();
    if (fetchError || !order) throw new Error("No se pudo recuperar la solicitud.");

    const orderItems = (order.order_items || []) as Array<{ title: string; quantity: number }>;
    const itemLines = orderItems.map((item) => `- ${item.quantity} x ${item.title}`).join("\n");
    const destinationLabel = [city, country].filter(Boolean).join(", ");
    const message = [
      "Hola MateArte, quiero coordinar una compra desde el exterior.",
      "",
      `Pedido #${order.order_number}`,
      `Nombre: ${fullName}`,
      `Destino: ${destinationLabel}`,
      "",
      "Artículos:",
      itemLines,
      "",
      `Subtotal sin envío: ${money(Number(order.items_subtotal_minor))}`,
      "Quiero coordinar el costo de envío internacional y la forma de pago.",
    ].join("\n");
    const whatsappUrl = `https://wa.me/${whatsappNumber()}?text=${encodeURIComponent(message)}`;

    return apiOk({ orderId, orderNumber: order.order_number, whatsappUrl }, 201);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "No se pudo crear la solicitud internacional.", 400);
  }
}

export const dynamic = "force-dynamic";
