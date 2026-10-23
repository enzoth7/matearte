import type { SupabaseClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, PaymentRefund } from "mercadopago";
import { refundPayPalCapture } from "./paypal";

export async function reviewCommerceOrder(admin: SupabaseClient, input: { orderId: string; decision: "approve" | "reject"; reason: string; actor: string }) {
  const { data: attempt, error } = await admin.rpc("begin_commerce_order_review", {
    p_order_id: input.orderId, p_decision: input.decision, p_reason: input.reason, p_actor: input.actor,
  });
  if (error) throw error;
  if (!attempt) throw new Error("No se pudo registrar la revisión.");
  if (attempt.status === "approved") return { pending: false, message: "Pedido aprobado." };
  if (attempt.status === "completed") return { pending: false, message: "Reembolso confirmado." };
  if (attempt.status === "manual") return { pending: true, message: "Transferencia pendiente de devolución manual." };
  if (!attempt.dispatch) return { pending: true, message: "Reembolso pendiente de confirmación." };

  // Dispatch exactly once. Ambiguous outcomes need provider reconciliation, never a new refund.
  let result: { id?: string | number; status?: string };
  try {
    if (attempt.provider === "paypal") {
      result = await refundPayPalCapture(attempt.provider_payment_id, attempt.id);
    } else if (attempt.provider === "mercado_pago") {
      const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
      if (!accessToken) throw new Error("Mercado Pago no está configurado.");
      result = await new PaymentRefund(new MercadoPagoConfig({ accessToken })).total({
        payment_id: attempt.provider_payment_id, requestOptions: { idempotencyKey: attempt.id },
      });
    } else throw new Error("Proveedor de reembolso no admitido.");
  } catch (error) {
    console.error("Reembolso pendiente de conciliación", { attemptId: attempt.id, error });
    return { pending: true, message: "Reembolso pendiente de confirmación. Revisá el estado con el proveedor antes de realizar otra devolución." };
  }
  const completed = Boolean(result.id) && (attempt.provider === "paypal" ? result.status === "COMPLETED" : result.status === "approved");
  const { error: finishError } = await admin.rpc("finish_commerce_refund", {
    p_attempt_id: attempt.id, p_completed: completed,
    p_provider_refund_id: result.id == null ? null : String(result.id), p_response: result,
  });
  if (finishError) throw new Error("Reembolso pendiente de confirmación en el sistema. No realices otra devolución.");
  return { pending: !completed, message: completed ? "Reembolso confirmado." : "Reembolso pendiente de confirmación." };
}
