import { MercadoPagoConfig, Payment, WebhookSignatureValidator } from "mercadopago";
import { apiError, apiOk } from "@/lib/api";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!secret || !accessToken) return apiError("Webhook no configurado.", 503);
  const url = new URL(request.url);
  let payload: Record<string, unknown>;
  try {
    const raw = await request.text();
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch { return apiError("JSON inválido.", 400); }
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};
  const dataId = String(url.searchParams.get("data.id") || data.id || "");
  if (!dataId) return apiError("Falta data.id.", 400);
  try {
    WebhookSignatureValidator.validate({ xSignature: signature, xRequestId: requestId, dataId, secret });
  } catch { return apiError("Firma inválida.", 401); }

  const type = String(payload.type || url.searchParams.get("type") || "");
  if (type !== "payment") return apiOk({ received: true, ignored: true });
  try {
    const payment = await new Payment(new MercadoPagoConfig({ accessToken, options: { timeout: 8_000 } })).get({ id: dataId });
    const eventId = String(payload.id || `${requestId}:${dataId}:${payload.action || "payment"}`);
    const { data: result, error } = await createAdminSupabase().rpc("process_mercado_pago_payment", {
      p_event_id: eventId,
      p_event_type: String(payload.action || "payment.updated"),
      p_event_payload: payload,
      p_payment: payment,
    });
    if (error) throw error;
    return apiOk({ received: true, result });
  } catch (error) {
    // A non-2xx response makes Mercado Pago retry the valid event.
    return apiError(error instanceof Error ? error.message : "No se pudo procesar el pago.", 500);
  }
}

export const dynamic = "force-dynamic";
