import { apiOk } from "@/lib/api";
import { customizerUrl } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST() {
  const client = await createServerSupabase();
  await client.auth.signOut({ scope: "global" });
  return apiOk({ continueAt: `${customizerUrl()}/?logout=1` });
}

export const dynamic = "force-dynamic";
