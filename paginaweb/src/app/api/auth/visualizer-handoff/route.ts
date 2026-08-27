import { apiError, apiOk } from "@/lib/api";
import { createOpaqueHandoffCode } from "@/lib/auth-handoff";
import { customizerUrl } from "@/lib/supabase/config";
import { createAdminSupabase, requireUser } from "@/lib/supabase/server";

export async function POST() {
  const { user } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);

  const { code, tokenHash } = createOpaqueHandoffCode();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 5 * 60_000);
  const admin = createAdminSupabase();
  const { error } = await admin.from("auth_handoffs").insert({
    token_hash: tokenHash,
    user_id: user.id,
    target_path: "/profile",
    action: "continue",
    payload: {},
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  if (error) return apiError("No pudimos conectar tu cuenta con el visualizador.", 400, error.message);

  return apiOk({ redirectUrl: `${customizerUrl()}/profile?handoff=${encodeURIComponent(code)}` }, 201);
}

export const dynamic = "force-dynamic";
