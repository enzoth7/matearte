import { MercadoPagoConfig, PaymentRefund } from "mercadopago";
import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api";
import { isAllowedCommerceAdminOrigin } from "@/lib/supabase/config";
import { createAdminSupabase, createTokenSupabase } from "@/lib/supabase/server";

const cors = (origin: string) => ({ "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" });
export function OPTIONS(request: Request) { const origin = request.headers.get("origin"); return origin && isAllowedCommerceAdminOrigin(origin) ? new Response(null, { status: 204, headers: cors(origin) }) : new Response(null, { status: 403 }); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  if (!origin || !isAllowedCommerceAdminOrigin(origin)) return apiError("Origen no permitido.", 403);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return apiError("Falta la sesión.", 401);
  const { data: { user } } = await createTokenSupabase(token).auth.getUser(token);
  if (!user) return apiError("Sesión inválida.", 401);
  const admin = createAdminSupabase();
  const membership = await admin.from("commerce_admin_users").select("user_id").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (!membership.data) return apiError("No tenés acceso al panel comercial.", 403);
  try {
    const { id } = await params; const body = await readJson(request); const decision = body.decision;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    const { data: order } = await admin.from("orders").select("id,status,commerce_payments(provider_payment_id,status)").eq("id", id).single();
    if (!order || order.status !== "paid_pending_review") return apiError("El pedido no está pendiente de revisión.", 409);
    if (decision === "approve") {
      await admin.from("order_items").update({ review_status: "approved", review_reason: null }).eq("order_id", id).eq("requires_review", true);
      const updated = await admin.from("orders").update({ status: "ready_for_production" }).eq("id", id).eq("status", "paid_pending_review");
      if (updated.error) throw updated.error;
    } else if (decision === "reject") {
      if (reason.length < 5) return apiError("Indicá el motivo del rechazo.");
      const payment = (order.commerce_payments as unknown as Array<{ provider_payment_id: string; status: string }>).find((item) => item.status === "approved");
      if (!payment) throw new Error("No se encontró el pago aprobado para reembolsar.");
      const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim(); if (!accessToken) throw new Error("Mercado Pago no está configurado.");
      const refund = await new PaymentRefund(new MercadoPagoConfig({ accessToken })).total({ payment_id: payment.provider_payment_id, requestOptions: { idempotencyKey: `refund-${id}` } });
      await admin.from("order_items").update({ review_status: "rejected", review_reason: reason }).eq("order_id", id).eq("requires_review", true);
      await admin.from("orders").update({ status: refund.status === "approved" ? "refunded" : "manual_review" }).eq("id", id);
    } else return apiError("Decisión inválida.");
    const response = NextResponse.json({ ok: true }); Object.entries(cors(origin)).forEach(([key, value]) => response.headers.set(key, value)); return response;
  } catch (error) { return apiError(error instanceof Error ? error.message : "No se pudo revisar el pedido.", 400); }
}

export const runtime = "nodejs";
