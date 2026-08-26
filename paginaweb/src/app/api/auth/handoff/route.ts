import { apiError, apiOk, readJson } from "@/lib/api";
import { customizerUrl, isAllowedCustomizerOrigin, siteUrl, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { createTokenSupabase } from "@/lib/supabase/server";

const allowedTargets = new Set(["/", "/carrito", "/checkout", "/pedidos", "/perfil"]);
const allowedActions = new Set(["continue", "open_cart", "add_design", "checkout"]);

function cors(origin: string | null): Record<string, string> {
  return isAllowedCustomizerOrigin(origin) ? {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  } : {};
}

function withCors(response: Response, origin: string | null) {
  Object.entries(cors(origin)).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedCustomizerOrigin(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: cors(origin) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedCustomizerOrigin(origin)) return apiError("Origen no permitido.", 403);
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return withCors(apiError("Falta la sesión.", 401), origin);

  const tokenClient = createTokenSupabase(accessToken);
  const { data: { user }, error: userError } = await tokenClient.auth.getUser(accessToken);
  if (userError || !user) return withCors(apiError("La sesión no es válida.", 401), origin);

  try {
    const body = await readJson(request);
    const targetPath = typeof body.targetPath === "string" ? body.targetPath : "/";
    const action = typeof body.action === "string" ? body.action : "continue";
    const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};
    if (!allowedTargets.has(targetPath) || !allowedActions.has(action)) return withCors(apiError("Destino o acción no permitidos.", 400), origin);
    if (JSON.stringify(payload).length > 2_000) return withCors(apiError("La acción pendiente es demasiado grande.", 413), origin);

    const edgeResponse = await fetch(`${supabaseUrl()}/functions/v1/auth-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, apikey: supabasePublishableKey(), Origin: origin! },
      body: JSON.stringify({ mode: "create", targetPath, action, payload }),
    });
    const edgeValue = await edgeResponse.json();
    if (!edgeResponse.ok || !edgeValue.code) throw new Error(edgeValue.error || "No se pudo crear el traspaso.");

    return withCors(apiOk({ redirectUrl: `${siteUrl()}/auth/handoff?code=${encodeURIComponent(edgeValue.code)}` }, 201), origin);
  } catch (error) {
    return withCors(apiError(error instanceof Error ? error.message : "No se pudo iniciar el traspaso.", 400), origin);
  }
}

export const dynamic = "force-dynamic";

// Exported for UI links and tests; this value is never treated as an allowed request origin.
export const loginUrl = `${customizerUrl()}/?auth=login&next=profile`;
