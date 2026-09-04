import { apiError, apiOk } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);
  const { id } = await params;
  const { data, error } = await client.from("orders").select("id,order_number,status,shipping_method,shipping_snapshot,customer_snapshot,items_subtotal_minor,shipping_minor,payment_fee_minor,total_minor,currency,created_at,paid_at,order_items(id,item_type,title,quantity,unit_price_minor,total_minor,requires_review,review_status)").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !data) return apiError("El pedido no existe.", 404);
  return apiOk(data);
}

export const dynamic = "force-dynamic";
