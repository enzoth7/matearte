import { apiError, apiOk, readJson } from "@/lib/api";
import { capturePayPalOrder } from "@/lib/paypal";
import { dispatchCommerceEmails } from "@/lib/commerce-email";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);

  try {
    const body = await readJson(request);
    const orderID = typeof body.orderID === "string" ? body.orderID.trim() : "";
    if (!orderID) return apiError("Falta el ID de la orden de PayPal.");

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
      const amountUsd = capture.amount?.value;

      const admin = createAdminSupabase();
      const { data: rpcResult, error: rpcError } = await admin.rpc("process_paypal_payment", {
        p_event_id: `capture-${captureId}`,
        p_event_type: "PAYMENT.CAPTURE.COMPLETED",
        p_paypal_order_id: orderID,
        p_capture_id: captureId,
        p_amount_usd_minor: Math.round(parseFloat(amountUsd) * 100),
        p_capture_payload: captureData,
      });
      if (rpcError) throw rpcError;

      const orderId = rpcResult && typeof rpcResult === "object" && "orderId" in rpcResult && typeof rpcResult.orderId === "string" ? rpcResult.orderId : null;
      if (orderId) await dispatchCommerceEmails(orderId);

      return apiOk({ status: "COMPLETED", captureId });
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
