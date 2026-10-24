import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.PRICING_ADMIN_EMAIL || "pricing-admin@matearte.uy").trim().toLowerCase();
const username = (process.env.PRICING_ADMIN_USERNAME || "user").trim().toLowerCase();
const password = process.env.MATEARTE_ADMIN_PASSWORD;

if (!url || !secretKey || !password) {
  throw new Error("Definí SUPABASE_URL, SUPABASE_SECRET_KEY y MATEARTE_ADMIN_PASSWORD antes de ejecutar este script.");
}

const client = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let user = null;
for (let page = 1; page <= 10 && !user; page += 1) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  user = data.users.find((item) => item.email?.toLowerCase() === email) ?? null;
  if (data.users.length < 100) break;
}

if (user) {
  const { data, error } = await client.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });
  if (error) throw error;
  user = data.user;
} else {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  user = data.user;
}

const { error: membershipError } = await client
  .from("admin_users")
  .upsert({ user_id: user.id, username, active: true }, { onConflict: "user_id" });
if (membershipError) throw membershipError;

process.stdout.write(`Administrador ${username} provisionado correctamente.\n`);
