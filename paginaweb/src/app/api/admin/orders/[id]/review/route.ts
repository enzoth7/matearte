import { reviewCommerceOrder } from "@/lib/commerce-review";
import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api";
import { dispatchCommerceEmails } from "@/lib/commerce-email";
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
    if (decision !== "approve" && decision !== "reject") return apiError("Decisión inválida.");
    if (decision === "reject" && reason.length < 5) return apiError("Indicá el motivo del rechazo.");
    const result = await reviewCommerceOrder(admin, { orderId: id, decision, reason, actor: user.id });
    const { data: order } = await admin.from("orders").select("customer_snapshot").eq("id", id).single();
    if ((order?.customer_snapshot as Record<string,unknown>)?.purchaseFlow !== "wholesale_bank_transfer") await dispatchCommerceEmails(id);
    const response = NextResponse.json({ ok: true, ...result }, { status: result.pending ? 202 : 200 }); Object.entries(cors(origin)).forEach(([key, value]) => response.headers.set(key, value)); return response;
  } catch (error) { const response = apiError(error instanceof Error ? error.message : "No se pudo revisar el pedido.", 409); Object.entries(cors(origin)).forEach(([key, value]) => response.headers.set(key, value)); return response; }
}

export const runtime = "nodejs";
