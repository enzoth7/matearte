import "server-only";
import { createAdminSupabase, createPublicSupabase } from "@/lib/supabase/server";
import { argentinaReady, arsPerUyuFromFinanceRate, type ArgentinaSettings } from "./argentina";

export async function getArgentinaDisplayRate(): Promise<number> {
  // ARS in Finanzas → Monedas is settings.exchange_rate (UYU per ARS).
  // Read it only on the server; do not expose the settings table to visitors.
  const rate = await createAdminSupabase().from("settings").select("exchange_rate").eq("id", 1).maybeSingle();
  return rate.error ? 0 : arsPerUyuFromFinanceRate(rate.data?.exchange_rate);
}

export async function getArgentinaSettings(): Promise<ArgentinaSettings | null> {
  const { data, error } = await createPublicSupabase().from("commerce_argentina_settings").select("enabled,bank_name,account_holder,cbu,alias").eq("singleton", true).maybeSingle();
  if (error || !data?.enabled) return null;
  const settings = { ...data, ars_per_uyu: await getArgentinaDisplayRate() };
  return argentinaReady(settings) ? settings : null;
}

export async function getArgentinaBasePricing(): Promise<boolean> {
  const { data, error } = await createPublicSupabase().from("commerce_settings").select("ars_use_base_price").eq("singleton", true).single();
  if (error) throw error;
  return data.ars_use_base_price === true;
}
