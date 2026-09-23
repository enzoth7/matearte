import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api";
import { isAllowedCommerceAdminOrigin } from "@/lib/supabase/config";
import { createAdminSupabase, createTokenSupabase } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  Vary: "Origin",
});

function responseWithCors(body: unknown, origin: string, status = 200) {
  const response = NextResponse.json(body, { status });
  Object.entries(cors(origin)).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return origin && isAllowedCommerceAdminOrigin(origin)
    ? new Response(null, { status: 204, headers: cors(origin) })
    : new Response(null, { status: 403 });
}

async function authorize(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !isAllowedCommerceAdminOrigin(origin)) return { error: apiError("Origen no permitido.", 403) };
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: responseWithCors({ error: "Falta la sesión." }, origin, 401) };
  const { data: { user } } = await createTokenSupabase(token).auth.getUser(token);
  if (!user) return { error: responseWithCors({ error: "Sesión inválida." }, origin, 401) };
  const admin = createAdminSupabase();
  const membership = await admin.from("commerce_admin_users").select("user_id").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (!membership.data) return { error: responseWithCors({ error: "No tenés acceso al panel comercial." }, origin, 403) };
  return { origin, user, admin };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!uuid.test(id)) return responseWithCors({ error: "El pedido no existe." }, auth.origin, 404);
  const receipt = await auth.admin
    .from("commerce_bank_transfer_receipts")
    .select("id,order_id,original_name,mime_type,byte_size,status,rejection_reason,submitted_at,reviewed_at,storage_path")
    .eq("order_id", id)
    .maybeSingle();
  if (receipt.error) return responseWithCors({ error: "No se pudo consultar el comprobante." }, auth.origin, 500);
  if (!receipt.data) return responseWithCors({ error: "El pedido no tiene comprobante." }, auth.origin, 404);
  const signed = await auth.admin.storage.from("bank-transfer-receipts").createSignedUrl(receipt.data.storage_path, 300);
  if (signed.error || !signed.data?.signedUrl) return responseWithCors({ error: "No se pudo abrir el comprobante." }, auth.origin, 500);
  const safeReceipt = {
    id: receipt.data.id,
    order_id: receipt.data.order_id,
    original_name: receipt.data.original_name,
    mime_type: receipt.data.mime_type,
    byte_size: receipt.data.byte_size,
    status: receipt.data.status,
    rejection_reason: receipt.data.rejection_reason,
    submitted_at: receipt.data.submitted_at,
    reviewed_at: receipt.data.reviewed_at,
  };
  return responseWithCors({ receipt: safeReceipt, signedUrl: signed.data.signedUrl }, auth.origin);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!uuid.test(id)) return responseWithCors({ error: "El pedido no existe." }, auth.origin, 404);
  try {
    const body = await readJson(request);
    const decision = body.decision === "approve" || body.decision === "reject" ? body.decision : "";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (!decision) return responseWithCors({ error: "Decisión inválida." }, auth.origin, 400);
    if (decision === "reject" && reason.length < 5) return responseWithCors({ error: "Indicá el motivo del rechazo." }, auth.origin, 400);
    const { data, error } = await auth.admin.rpc("review_wholesale_bank_transfer_order", {
      p_admin_id: auth.user.id,
      p_order_id: id,
      p_decision: decision,
      p_reason: reason || null,
    });
    if (error) throw error;
    return responseWithCors({ ok: true, result: data }, auth.origin);
  } catch (error) {
    return responseWithCors({ error: error instanceof Error ? error.message : "No se pudo revisar el comprobante." }, auth.origin, 400);
  }
}

export const runtime = "nodejs";
