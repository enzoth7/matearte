import { apiError, apiOk, readJson } from "@/lib/api";
import { capturePayPalOrder } from "@/lib/paypal";
import { paypalUsdMinor } from "@/lib/paypal-money";
import { dispatchCommerceEmails } from "@/lib/commerce-email";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);

  try {
    const body = await readJson(request);
    const orderID = typeof body.orderID === "string" ? body.orderID.trim() : "";
    if (!/^[A-Z0-9]+$/.test(orderID)) return apiError("ID de PayPal inválido.");
    const admin = createAdminSupabase();
    const { data: order, error: orderError } = await admin.from("orders")
      .select("id,status,paid_at,paypal_amount_usd_minor")
      .eq("paypal_order_id", orderID).eq("user_id", user.id).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return apiError("Pedido no encontrado.", 404);
    if (["cancelled", "refunded", "payment_failed"].includes(order.status)) return apiError("El pedido ya no admite cobros.", 409);
    if (order.paid_at) return apiOk({ status: order.status === "manual_review" ? "PENDING" : "COMPLETED" });
    if (order.status !== "pending_payment") return apiError("El pedido no está pendiente de pago.", 409);

    let captureData;
    try {
      captureData = await capturePayPalOrder(orderID);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("INSTRUMENT_DECLINED")) {
        return apiOk({ status: "DECLINED", recoverable: true });
      }
      throw err;
    }

    if (captureData.status === "COMPLETED") {
      const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
      if (!capture) throw new Error("Formato de captura inválido.");

      const captureId = capture.id;
      const amountMinor = paypalUsdMinor(capture.amount);
      if (!captureId || capture.status !== "COMPLETED") throw new Error("Captura no confirmada.");
      const { data: rpcResult, error: rpcError } = await admin.rpc("process_paypal_payment", {
        p_event_id: `capture-${captureId}`,
        p_event_type: "PAYMENT.CAPTURE.COMPLETED",
        p_paypal_order_id: orderID,
        p_capture_id: captureId,
        p_amount_usd_minor: amountMinor,
        p_capture_payload: captureData,
      });
      if (rpcError) throw rpcError;

      const orderId = rpcResult && typeof rpcResult === "object" && "orderId" in rpcResult && typeof rpcResult.orderId === "string" ? rpcResult.orderId : null;
      if (orderId) await dispatchCommerceEmails(orderId);

      return apiOk({ status: rpcResult?.manualReview ? "PENDING" : "COMPLETED", captureId });
    }

    // Handle declined instrument
    const details = Array.isArray(captureData.details) ? captureData.details : [];
    const isDeclined = details.some((d: Record<string, unknown>) => d.issue === "INSTRUMENT_DECLINED");
    if (isDeclined) {
      return apiOk({ status: "DECLINED", recoverable: true });
    }

    return apiOk({ status: captureData.status });
  } catch (error) {
    console.error("PayPal capture-order error:", error);
    return apiError(error instanceof Error ? error.message : "No se pudo capturar el pago.", 500);
  }
}

export const dynamic = "force-dynamic";
