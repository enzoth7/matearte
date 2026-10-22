import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const allowedOrigins = new Set([
  "https://matearte-commerce-admin.vercel.app",
  "https://matearte-gestion.vercel.app",
  "http://127.0.0.1:5180",
  "http://127.0.0.1:5181",
  "http://localhost:5180",
  "http://localhost:5181",
  ...(Deno.env.get("GESTION_ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean),
]);
const fixedAccessUserIds = ["t1", "t2", "t3", "t5"];
const isManagedId = (id: string) => ["t2", "t3", "t5"].includes(id) || /^u[0-9a-f]{8}$/.test(id);
const defaultNewUserPaths = ["/inicio/resumen"];
const headers = (origin: string) => ({
  "Content-Type": "application/json",
  ...(allowedOrigins.has(origin) ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  } : {}),
});
const json = (body: unknown, status: number, origin: string) => new Response(JSON.stringify(body), { status, headers: headers(origin) });

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") return allowedOrigins.has(origin) ? new Response(null, { status: 204, headers: headers(origin) }) : new Response(null, { status: 403 });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origen no permitido." }, 403, origin);

  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return json({ error: "Falta la sesión." }, 401, origin);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "JSON inválido." }, 400, origin); }

  const { count: ownerCount } = await service.from("commerce_admin_users").select("user_id", { count: "exact", head: true }).eq("access_user_id", "t1").eq("active", true);
  if (body.action === "status") return json({ needsSetup: !ownerCount }, 200, origin);
  if (body.action === "bootstrap") {
    if (ownerCount) return json({ error: "El acceso inicial ya fue configurado." }, 409, origin);
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[a-z0-9._-]{3,64}$/.test(username)) return json({ error: "El usuario debe tener entre 3 y 64 caracteres válidos." }, 400, origin);
    if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400, origin);
    const email = `${username}@matearte.uy`;
    const { data: existing } = await service.from("commerce_admin_users").select("user_id").eq("active", true).order("created_at").limit(1).maybeSingle();
    let ownerId = existing?.user_id as string | undefined;
    if (ownerId) {
      const { error } = await service.auth.admin.updateUserById(ownerId, { email, password, email_confirm: true });
      if (error) return json({ error: error.message.includes("already") ? "Ese usuario ya está en uso." : "No se pudo configurar el acceso inicial." }, 400, origin);
    } else {
      const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) return json({ error: error?.message.includes("already") ? "Ese usuario ya está en uso." : "No se pudo crear el acceso inicial." }, 400, origin);
      ownerId = data.user.id;
    }
    const { error } = await service.from("commerce_admin_users").upsert({ user_id: ownerId, access_user_id: "t1", display_name: "Richard Ortiz", active: true }, { onConflict: "user_id" });
    if (error) return json({ error: "No se pudo asignar el acceso de administrador." }, 500, origin);
    return json({ username }, 201, origin);
  }

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false } });
  const { data: { user } } = await userClient.auth.getUser(bearer);
  if (!user) return json({ error: "Sesión inválida." }, 401, origin);
  const { data: caller } = await service.from("commerce_admin_users").select("access_user_id,active").eq("user_id", user.id).maybeSingle();
  if (!caller?.active || caller.access_user_id !== "t1") return json({ error: "Solo Richard puede administrar usuarios." }, 403, origin);

  if (body.action === "list") {
    const { data: memberships, error } = await service.from("commerce_admin_users").select("user_id,access_user_id,display_name,allowed_paths,active").or(`access_user_id.in.(${fixedAccessUserIds.join(",")}),access_user_id.like.u*`).order("created_at");
    if (error) return json({ error: "No se pudieron cargar los usuarios." }, 500, origin);
    const users = await Promise.all((memberships || []).map(async (membership) => {
      const { data } = await service.auth.admin.getUserById(membership.user_id);
      const email = data.user?.email || "";
      return {
        userId: membership.user_id,
        accessUserId: membership.access_user_id,
        displayName: membership.display_name,
        username: email.endsWith("@matearte.uy") ? email.slice(0, -"@matearte.uy".length) : email,
        configured: Boolean(data.user),
        active: membership.active !== false,
        allowedPaths: membership.allowed_paths,
      };
    }));
    return json({ users }, 200, origin);
  }
  if (body.action === "setActive") {
    const accessUserId = typeof body.accessUserId === "string" ? body.accessUserId : "";
    if (!isManagedId(accessUserId) || typeof body.active !== "boolean") {
      return json({ error: "Revisá los datos del usuario." }, 400, origin);
    }
    const { data, error } = await service.from("commerce_admin_users")
      .update({ active: body.active })
      .eq("access_user_id", accessUserId)
      .select("access_user_id,active")
      .maybeSingle();
    if (error || !data) return json({ error: "No se pudo cambiar el estado del usuario." }, error ? 500 : 404, origin);
    return json({ accessUserId: data.access_user_id, active: data.active }, 200, origin);
  }
  if (body.action === "savePermissions") {
    const accessUserId = typeof body.accessUserId === "string" ? body.accessUserId : "";
    const allowedPaths = Array.isArray(body.allowedPaths)
      ? [...new Set(body.allowedPaths.filter((path): path is string => typeof path === "string"))]
      : null;
    if (!isManagedId(accessUserId) || !allowedPaths || allowedPaths.length > 100) {
      return json({ error: "Revisá los permisos seleccionados." }, 400, origin);
    }
    if (allowedPaths.some((path) => !path.startsWith("/") || path === "/administracion/usuarios" || path.startsWith("/finanzas/"))) {
      return json({ error: "Hay una sección que sólo puede usar Richard." }, 400, origin);
    }
    const { data, error } = await service.from("commerce_admin_users")
      .update({ allowed_paths: allowedPaths })
      .eq("access_user_id", accessUserId)
      .select("access_user_id,allowed_paths")
      .maybeSingle();
    if (error || !data) return json({ error: "No se pudieron guardar los permisos." }, error ? 500 : 404, origin);
    return json({ accessUserId: data.access_user_id, allowedPaths: data.allowed_paths }, 200, origin);
  }
  if (body.action === "create") {
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
    if (!displayName || !/^[a-z0-9._-]{3,64}$/.test(username)) return json({ error: "Revisá los datos del usuario." }, 400, origin);
    if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400, origin);
    const { data: created, error: createError } = await service.auth.admin.createUser({ email: `${username}@matearte.uy`, password, email_confirm: true });
    if (createError || !created.user) return json({ error: createError?.message.includes("already") ? "Ese usuario ya está en uso." : "No se pudo crear el usuario." }, 400, origin);
    const accessUserId = `u${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
    const { error: insertError } = await service.from("commerce_admin_users").insert({ user_id: created.user.id, access_user_id: accessUserId, display_name: displayName, active: true, allowed_paths: defaultNewUserPaths });
    if (insertError) {
      await service.auth.admin.deleteUser(created.user.id);
      return json({ error: "No se pudo asignar el acceso a la persona." }, 500, origin);
    }
    return json({ user: { accessUserId, displayName, username, configured: true, active: true, allowedPaths: defaultNewUserPaths } }, 201, origin);
  }
  if (body.action !== "save") return json({ error: "Operación inválida." }, 400, origin);

  const accessUserId = typeof body.accessUserId === "string" ? body.accessUserId : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
  if (!(accessUserId === "t1" || isManagedId(accessUserId)) || !/^[a-z0-9._-]{3,64}$/.test(username) || !displayName) return json({ error: "Revisá los datos del usuario." }, 400, origin);
  if (password && password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400, origin);

  const email = `${username}@matearte.uy`;
  let membershipQuery = service.from("commerce_admin_users").select("user_id,allowed_paths,active").eq("access_user_id", accessUserId);
  if (accessUserId === "t1" && typeof body.userId === "string") membershipQuery = membershipQuery.eq("user_id", body.userId);
  const { data: membership } = await membershipQuery.order("created_at").limit(1).maybeSingle();
  let userId = membership?.user_id as string | undefined;
  if (userId) {
    const attributes: { email: string; password?: string; email_confirm: boolean } = { email, email_confirm: true };
    if (password) attributes.password = password;
    const { error } = await service.auth.admin.updateUserById(userId, attributes);
    if (error) return json({ error: error.message.includes("already") ? "Ese usuario ya está en uso." : "No se pudo actualizar el usuario." }, 400, origin);
  } else {
    if (!password) return json({ error: "Ingresá una contraseña para el usuario nuevo." }, 400, origin);
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) return json({ error: error?.message.includes("already") ? "Ese usuario ya está en uso." : "No se pudo crear el usuario." }, 400, origin);
    userId = data.user.id;
  }
  const { error: membershipError } = await service.from("commerce_admin_users").upsert({ user_id: userId, access_user_id: accessUserId, display_name: displayName, active: membership ? membership.active !== false : true,
    ...(accessUserId === "t5" ? { allowed_paths: membership?.allowed_paths || ["/marketing/campanas","/marketing/sorteo","/marketing/contactos","/marketing/suscripcion","/marketing/analytics","/marketing/descuentos","/marketing/avisos"] } : {}),
  }, { onConflict: "user_id" });
  if (membershipError) return json({ error: "Se creó el acceso, pero no se pudo asignar a la persona." }, 500, origin);
  return json({ user: { userId, accessUserId, username, configured: true } }, 200, origin);
});
