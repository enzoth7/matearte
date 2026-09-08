import { apiError, apiOk } from "@/lib/api";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await createAdminSupabase().from("shipping_rates").select("id,code,name,departments,is_pickup").eq("active", true).order("is_pickup", { ascending: false }).order("name");
  if (error) return apiError("No se pudieron cargar las opciones de entrega.", 500);
  return apiOk({ rates: (data || []).map((rate) => ({ ...rate, rate_minor: 0 })) });
}
