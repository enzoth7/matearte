import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const allowedOrigins = new Set(["https://matearte-visualizador.vercel.app", "http://localhost:5173"]);
const allowedTargets = new Set(["/", "/carrito", "/checkout", "/pedidos", "/perfil"]);
const allowedActions = new Set(["continue", "open_cart", "add_design", "checkout"]);
const headers = (origin = "") => ({ "Content-Type": "application/json", ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" } : {}) });
const json = (body: unknown, status = 200, origin = "") => new Response(JSON.stringify(body), { status, headers: headers(origin) });
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
const hash = async (value: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") return allowedOrigins.has(origin) ? new Response(null, { status: 204, headers: headers(origin) }) : new Response(null, { status: 403 });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405, origin);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "JSON inválido." }, 400, origin); }

  if (body.mode === "create") {
    if (!allowedOrigins.has(origin)) return json({ error: "Origen no permitido." }, 403, origin);
    const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return json({ error: "Falta la sesión." }, 401, origin);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false } });
    const { data: { user } } = await userClient.auth.getUser(bearer);
    if (!user) return json({ error: "Sesión inválida." }, 401, origin);
    const targetPath = typeof body.targetPath === "string" ? body.targetPath : "/";
    const action = typeof body.action === "string" ? body.action : "continue";
    const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};
    if (!allowedTargets.has(targetPath) || !allowedActions.has(action) || JSON.stringify(payload).length > 2_000) return json({ error: "Acción no permitida." }, 400, origin);
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const code = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    const { error } = await service.from("auth_handoffs").insert({ token_hash: await hash(code), user_id: user.id, target_path: targetPath, action, payload, expires_at: new Date(Date.now() + 300_000).toISOString() });
    if (error) return json({ error: "No se pudo crear el traspaso." }, 500, origin);
    return json({ code }, 201, origin);
  }

  if (body.mode === "consume") {
    const code = typeof body.code === "string" ? body.code : "";
    if (!/^[A-Za-z0-9_-]{43}$/.test(code)) return json({ error: "Código inválido." }, 400, origin);
    const now = new Date().toISOString();
    const { data: handoff } = await service.from("auth_handoffs").update({ consumed_at: now }).eq("token_hash", await hash(code)).is("consumed_at", null).gt("expires_at", now).select("user_id,target_path,action,payload").maybeSingle();
    if (!handoff) return json({ error: "Código usado o vencido." }, 410, origin);
    const { data: userData } = await service.auth.admin.getUserById(handoff.user_id);
    if (!userData.user?.email) return json({ error: "Usuario inválido." }, 400, origin);
    const { data: linkData, error } = await service.auth.admin.generateLink({ type: "magiclink", email: userData.user.email });
    if (error || !linkData.properties?.hashed_token) return json({ error: "No se pudo crear la sesión." }, 500, origin);
    return json({ tokenHash: linkData.properties.hashed_token, targetPath: handoff.target_path, action: handoff.action, payload: handoff.payload }, 200, origin);
  }
  return json({ error: "Operación inválida." }, 400, origin);
});
