import { apiOk } from "@/lib/api";
import { personalizerUrl } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST() {
  const client = await createServerSupabase();
  await client.auth.signOut({ scope: "global" });
  return apiOk({ continueAt: `${personalizerUrl()}/?logout=1` });
}

export const dynamic = "force-dynamic";
