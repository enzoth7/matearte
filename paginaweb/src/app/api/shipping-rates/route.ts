import { apiError, apiOk } from "@/lib/api";
import { createAdminSupabase } from "@/lib/supabase/server";
import { DEFAULT_INTERNATIONAL_SHIPPING_RATES, type InternationalShippingRow } from "@/lib/international-shipping";

export async function GET() {
  const admin = createAdminSupabase();
  const [{ data: domestic, error: domesticError }, { data: intlData }] = await Promise.all([
    admin.from("shipping_rates").select("id,code,name,departments,is_pickup").eq("active", true).order("is_pickup", { ascending: false }).order("name"),
    admin.from("commerce_international_shipping_rates").select("*").order("row_order", { ascending: true }),
  ]);
  if (domesticError) return apiError("No se pudieron cargar las opciones de entrega.", 500);

  const rates = (domestic || []).map((rate) => ({ ...rate, rate_minor: 0 }));
  const internationalRates = (intlData && intlData.length > 0)
    ? (intlData as InternationalShippingRow[])
    : DEFAULT_INTERNATIONAL_SHIPPING_RATES;

  return apiOk({ rates, internationalRates });
}

