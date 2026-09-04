import { createClient } from "@supabase/supabase-js";

const cleanEnv = (value = "") => value.trim().replace(/^"|"$/g, "").replace(/\\[rn]/g, "").trim();
const url = cleanEnv(process.env.SUPABASE_URL);
const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
const email = (process.env.COMMERCE_TEST_ADMIN_EMAIL || "user@matearte.uy").trim().toLowerCase();
const password = process.env.COMMERCE_TEST_ADMIN_PASSWORD;

if (!url || !serviceRoleKey || !password) {
  throw new Error("Definí SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y COMMERCE_TEST_ADMIN_PASSWORD.");
}

const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
let user = null;
for (let page = 1; page <= 10 && !user; page += 1) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  user = data.users.find((item) => item.email?.toLowerCase() === email) ?? null;
  if (data.users.length < 100) break;
}

if (user) {
  const { data, error } = await client.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) throw error;
  user = data.user;
} else {
  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
}

const { error } = await client.from("commerce_admin_users").upsert(
  { user_id: user.id, display_name: "Usuario de prueba", active: true },
  { onConflict: "user_id" },
);
if (error) throw error;
process.stdout.write("Cuenta de prueba de Comercio provisionada.\n");
