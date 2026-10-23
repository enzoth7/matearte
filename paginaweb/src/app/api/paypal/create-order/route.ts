import { apiError, apiOk, readJson } from "@/lib/api";
import { createPayPalOrder } from "@/lib/paypal";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);

  try {
    const body = await readJson(request);
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) return apiError("Falta el ID del pedido.");

    const admin = createAdminSupabase();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, user_id, status, paypal_order_id, paypal_amount_usd_minor, order_number")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();

    if (orderError || !order) return apiError("Pedido no encontrado.", 404);

    if (order.status !== "pending_payment") return apiError("El pedido no está pendiente de pago.");
    if (order.paypal_order_id) return apiOk({ id: order.paypal_order_id });

    const totalUsd = Number(order.paypal_amount_usd_minor) / 100;
    if (!Number.isFinite(totalUsd) || totalUsd <= 0) throw new Error("El pedido no tiene un importe USD válido.");

    const paypalOrder = await createPayPalOrder({
      referenceId: order.id,
      description: `MateArte Order #${order.order_number}`,
      totalUsd,
      items: [
        {
          name: `MateArte Order #${order.order_number}`,
          quantity: 1,
          unitPriceUsd: totalUsd,
        },
      ],
    });

    if (typeof paypalOrder.id !== "string" || !paypalOrder.id) throw new Error("PayPal no devolvió una orden válida.");
    const { data: saved, error: saveError } = await admin
      .from("orders")
      .update({ paypal_order_id: paypalOrder.id })
      .eq("id", order.id).eq("status", "pending_payment").select("id").single();
    if (saveError || !saved) throw new Error("No se pudo asociar el pago al pedido. Volvé a intentarlo.");

    return apiOk({ id: paypalOrder.id });
  } catch (error) {
    console.error("PayPal create-order error:", error);
    return apiError(error instanceof Error ? error.message : "No se pudo crear la orden de PayPal.", 500);
  }
}

export const dynamic = "force-dynamic";
