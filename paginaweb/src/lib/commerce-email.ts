import "server-only";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/supabase/config";

export async function dispatchCommerceEmails(orderId: string) {
  try {
    const serviceKey = supabaseServiceRoleKey();
    const response = await fetch(`${supabaseUrl().replace(/\/$/, "")}/functions/v1/commerce-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ orderId }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    // The database outbox retains the event for a later retry.
    return false;
  }
}
