import { apiError, apiOk } from "@/lib/api";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return apiError("No autorizado.", 401);
  const { data, error } = await createAdminSupabase().rpc("release_expired_commerce_reservations");
  if (error) return apiError(error.message, 500);
  return apiOk({ releasedOrders: data });
}

export const dynamic = "force-dynamic";
