import { apiError, apiOk } from "@/lib/api";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";
import { validateReceipt } from "@/lib/transfer-receipt";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);
  const { id } = await params;
  const receiptId = request.headers.get("idempotency-key") || "";
  if (!uuid.test(id) || !uuid.test(receiptId)) return apiError("Identificador inválido.");
  const admin = createAdminSupabase();
  try {
    const order = await admin.from("orders").select("status,customer_snapshot").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!order.data || order.data.customer_snapshot?.purchaseFlow !== "argentina_retail_transfer") return apiError("Pedido no disponible.", 404);
    const previous = await admin.from("commerce_bank_transfer_receipts").select("id").eq("order_id", id).maybeSingle();
    if (previous.data?.id === receiptId) return apiOk({ ok: true });
    if (!["pending_payment", "payment_failed"].includes(order.data.status)) return apiError("El pedido no admite otro comprobante.", 409);
    const receipt = (await request.formData()).get("receipt");
    if (!(receipt instanceof File)) return apiError("Adjuntá un comprobante.");
    if (receipt.size < 1 || receipt.size > 5 * 1024 * 1024) return apiError("El comprobante debe tener entre 1 byte y 5 MB.");
    const bytes = new Uint8Array(await receipt.arrayBuffer());
    const extension = validateReceipt(receipt.type, bytes);
    const path = `${user.id}/${id}/${receiptId}.${extension}`;
    const upload = await admin.storage.from("bank-transfer-receipts").upload(path, bytes, { contentType: receipt.type, upsert: false });
    // A retry may find the immutable file from a request whose response was lost.
    if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw upload.error;
    const result = await admin.rpc("submit_argentina_receipt", { p_user_id: user.id, p_order_id: id, p_receipt_id: receiptId, p_path: path, p_name: receipt.name.slice(0, 240), p_mime: receipt.type, p_bytes: bytes.length });
    if (result.error) throw result.error;
    if (result.data?.previousPath && result.data.previousPath !== path) await admin.storage.from("bank-transfer-receipts").remove([result.data.previousPath]);
    return apiOk({ ok: true });
  } catch (error) { return apiError(error instanceof Error ? error.message : "No se pudo guardar el comprobante.", 400); }
}
export const runtime = "nodejs";
