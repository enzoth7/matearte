import "server-only";

import { unstable_cache } from "next/cache";
import {
  DEFAULT_INTERNATIONAL_SHIPPING_RATES,
  type InternationalShippingRow,
} from "@/lib/international-shipping";
import { createAdminSupabase } from "@/lib/supabase/server";

const shippingRateSelection = `
  row_order,
  weight_label,
  weight_min_g,
  weight_max_g,
  argentina,
  suramerica,
  estados_unidos,
  resto_america,
  espana,
  resto_europa,
  resto_mundo
`;

const loadMerchantShippingRates = unstable_cache(async () => {
  const client = createAdminSupabase();
  const { data, error } = await client
    .from("commerce_international_shipping_rates")
    .select(shippingRateSelection)
    .order("row_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as InternationalShippingRow[];
}, ["google-merchant-shipping-rates-v1"], { revalidate: 600, tags: ["catalog"] });

/** Uses the same configurable weight bands as checkout, with its checked-in rates as a safe fallback. */
export async function getMerchantShippingRates(): Promise<InternationalShippingRow[]> {
  try {
    const rates = await loadMerchantShippingRates();
    return rates.length > 0 ? rates : DEFAULT_INTERNATIONAL_SHIPPING_RATES;
  } catch (reason) {
    console.error("[google-merchant] No se pudieron cargar las tarifas internacionales.", reason);
    return DEFAULT_INTERNATIONAL_SHIPPING_RATES;
  }
}
