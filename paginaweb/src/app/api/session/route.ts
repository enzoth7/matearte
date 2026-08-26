import { apiOk } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

export async function GET() {
  const { user, client } = await requireUser();
  if (!user) return apiOk({ authenticated: false, user: null, cartCount: 0 });
  const [{ data: profile }, { data: cart }] = await Promise.all([
    client.from("customer_profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
    client.from("carts").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);
  let cartCount = 0;
  if (cart) {
    const { data } = await client.from("cart_items").select("quantity").eq("cart_id", cart.id);
    cartCount = (data || []).reduce((sum, item) => sum + item.quantity, 0);
  }
  return apiOk({ authenticated: true, user: { id: user.id, email: user.email, name: profile?.full_name || user.user_metadata.full_name || user.email?.split("@")[0] }, cartCount });
}

export const dynamic = "force-dynamic";
