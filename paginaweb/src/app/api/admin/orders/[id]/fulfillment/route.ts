import { NextResponse } from "next/server";
import { readJson } from "@/lib/api";
import { dispatchCommerceEmails } from "@/lib/commerce-email";
import { isAllowedCommerceAdminOrigin } from "@/lib/supabase/config";
import { createAdminSupabase, createTokenSupabase } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "PATCH, OPTIONS",
  Vary: "Origin",
});

function response(origin: string, body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { ...cors(origin), "Cache-Control": "private, no-store" } });
}

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return origin && isAllowedCommerceAdminOrigin(origin)
    ? new Response(null, { status: 204, headers: cors(origin) })
    : new Response(null, { status: 403 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  if (!origin || !isAllowedCommerceAdminOrigin(origin)) return response(origin || "null", { error: "Origen no permitido." }, 403);

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return response(origin, { error: "Falta la sesión." }, 401);

  const { data: { user } } = await createTokenSupabase(token).auth.getUser(token);
  if (!user) return response(origin, { error: "Sesión inválida." }, 401);

  const admin = createAdminSupabase();
  const membership = await admin
    .from("commerce_admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!membership.data) return response(origin, { error: "No tenés acceso al panel comercial." }, 403);

  try {
    const { id } = await params;
    if (!uuid.test(id)) return response(origin, { error: "El pedido no existe." }, 404);

    const body = await readJson(request);
    const action = body.action;
    if (action !== "ship" && action !== "restore") return response(origin, { error: "Acción inválida." }, 400);

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,status,shipping_method,shipped_at,order_items(requires_review)")
      .eq("id", id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return response(origin, { error: "El pedido no existe." }, 404);

    if (action === "ship") {
      if (!["ready_for_fulfillment", "ready_for_production", "shipped", "manual_review"].includes(order.status)) {
        return response(origin, { error: "El pedido todavía no está listo para enviarse." }, 409);
      }
      if (order.shipping_method === "pickup") {
        return response(origin, { error: "Los pedidos con retiro no se marcan como enviados." }, 409);
      }

      const shippingCarrier = typeof body.shippingCarrier === "string" ? body.shippingCarrier.trim() : "";
      const trackingCode = typeof body.trackingCode === "string" ? body.trackingCode.trim() : "";
      if (shippingCarrier.length < 2 || shippingCarrier.length > 120) {
        return response(origin, { error: "Ingresá una empresa de envío válida." }, 400);
      }
      if (trackingCode.length < 3 || trackingCode.length > 160) {
        return response(origin, { error: "Ingresá un código de seguimiento válido." }, 400);
      }

      const { data: updated, error: updateError } = await admin
        .from("orders")
        .update({
          status: "shipped",
          shipping_carrier: shippingCarrier,
          tracking_code: trackingCode,
          shipped_at: order.status === "shipped" && order.shipped_at ? order.shipped_at : new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", order.status)
        .select("id,status,shipping_carrier,tracking_code,shipped_at")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) return response(origin, { error: "El pedido cambió mientras lo actualizabas. Recargá e intentá de nuevo." }, 409);

      if (order.status !== "shipped") await dispatchCommerceEmails(id);
      return response(origin, { ok: true, order: updated });
    }

    if (order.status !== "shipped") {
      return response(origin, { error: "El pedido no está marcado como enviado." }, 409);
    }

    const hasCustomItem = (order.order_items as Array<{ requires_review: boolean }> | null)?.some((item) => item.requires_review) ?? false;
    const restoredStatus = order.shipping_method === "international_coordination" ? "manual_review" : hasCustomItem ? "ready_for_production" : "ready_for_fulfillment";
    const { data: updated, error: updateError } = await admin
      .from("orders")
      .update({ status: restoredStatus, shipped_at: null })
      .eq("id", id)
      .eq("status", "shipped")
      .select("id,status,shipping_carrier,tracking_code,shipped_at")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return response(origin, { error: "El pedido cambió mientras lo actualizabas. Recargá e intentá de nuevo." }, 409);

    return response(origin, { ok: true, order: updated });
  } catch (error) {
    return response(origin, { error: error instanceof Error ? error.message : "No se pudo actualizar el envío." }, 400);
  }
}

export const runtime = "nodejs";
