import { apiError, apiOk } from "@/lib/api";
import { orderItemImagePath, type OrderItemImageSource } from "@/lib/order-item-image";
import { requireUser } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);
  const { id } = await params;
  if (!uuid.test(id)) return apiError("El pedido no existe.", 404);
  const { data, error } = await client.from("orders").select(`
    id,order_number,status,shipping_method,shipping_snapshot,shipping_carrier,tracking_code,shipped_at,customer_snapshot,
    items_subtotal_minor,shipping_minor,payment_fee_minor,total_minor,currency,created_at,paid_at,
    order_items(
      id,item_type,title,quantity,unit_price_minor,total_minor,requires_review,review_status,source_variant_id,
      variant:commerce_variants(product:commerce_products(commerce_product_images(storage_path,sort_order,variant_id)))
    )
  `).or(`id.eq.${id},checkout_idempotency_key.eq.${id}`).eq("user_id", user.id).maybeSingle();
  if (error) return apiError("No se pudo consultar el pedido.", 500);
  if (!data) {
    const awaitingConfirmation = new URL(request.url).searchParams.get("awaiting") === "1";
    return awaitingConfirmation ? apiOk({ pending: true }, 202) : apiError("El pedido no existe.", 404);
  }
  const orderItems = (data.order_items || []).map((item) => {
    const imagePath = orderItemImagePath(item as OrderItemImageSource);
    return {
      id: item.id,
      item_type: item.item_type,
      title: item.title,
      quantity: item.quantity,
      unit_price_minor: item.unit_price_minor,
      total_minor: item.total_minor,
      requires_review: item.requires_review,
      review_status: item.review_status,
      image_url: imagePath
        ? client.storage.from("product-images").getPublicUrl(imagePath).data.publicUrl
        : null,
    };
  });

  return apiOk({ ...data, order_items: orderItems });
}

export const dynamic = "force-dynamic";
