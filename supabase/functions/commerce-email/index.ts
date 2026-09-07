import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { buildCommerceEmail, type EmailJob, type EmailOrder, type EmailOrderItem } from "./templates.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
};

const supabaseSecretKeys = () => {
  const keys = [Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""];
  try {
    const configured = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}") as Record<string, unknown>;
    keys.push(...Object.values(configured).filter((value): value is string => typeof value === "string"));
  } catch {
    // The legacy key above remains a supported fallback.
  }
  return [...new Set(keys.filter(Boolean))];
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const apiKey = request.headers.get("apikey") || "";
  const serverKeys = supabaseSecretKeys();
  if (!supabaseUrl || !serverKeys.length) return json({ error: "Supabase no entregó una credencial interna." }, 503);
  const admin = createClient(supabaseUrl, serverKeys[0], { auth: { persistSession: false } });
  const configResult = await admin.rpc("get_email_delivery_config");
  if (configResult.error) return json({ error: configResult.error.message }, 500);
  const config = (configResult.data || {}) as Record<string, string>;
  const trustedKeys = [...serverKeys, config.matearte_lifecycle_service_role].filter(Boolean);
  const authorized = trustedKeys.some((key) => safeEqual(bearer, key) || safeEqual(apiKey, key));
  if (!authorized) return json({ error: "No autorizado." }, 401);
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() || config.matearte_resend_api_key;
  const emailFrom = Deno.env.get("COMMERCE_EMAIL_FROM")?.trim() || config.matearte_email_from;
  const replyTo = Deno.env.get("COMMERCE_EMAIL_REPLY_TO")?.trim() || config.matearte_email_reply_to;
  const adminEmails = (Deno.env.get("COMMERCE_ADMIN_EMAIL") || config.matearte_admin_email || "").split(",").map((value) => value.trim()).filter(Boolean);
  const siteUrl = (Deno.env.get("MATEARTE_SITE_URL") || config.matearte_site_url || "https://www.matearteuruguay.com").trim();
  const missing = [
    !resendApiKey && "RESEND_API_KEY",
    !emailFrom && "COMMERCE_EMAIL_FROM",
    !replyTo && "COMMERCE_EMAIL_REPLY_TO",
    !adminEmails.length && "COMMERCE_ADMIN_EMAIL",
  ].filter(Boolean);
  if (missing.length) return json({ error: "El correo transaccional todavía no está configurado.", missing }, 503);

  let body: { orderId?: unknown; limit?: unknown };
  try { body = await request.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const orderId = typeof body.orderId === "string" && /^[0-9a-f-]{36}$/i.test(body.orderId) ? body.orderId : null;
  const limit = typeof body.limit === "number" ? Math.min(Math.max(Math.floor(body.limit), 1), 50) : 20;
  const firstClaim = await admin.rpc("claim_commerce_email_jobs", { p_order_id: orderId, p_limit: limit });
  if (firstClaim.error) return json({ error: firstClaim.error.message }, 500);
  const claimed = [...(firstClaim.data || [])];
  if (orderId && claimed.length < limit) {
    const retryClaim = await admin.rpc("claim_commerce_email_jobs", { p_order_id: null, p_limit: limit - claimed.length });
    if (retryClaim.error) return json({ error: retryClaim.error.message }, 500);
    claimed.push(...(retryClaim.data || []));
  }

  const jobs = claimed as Array<EmailJob & { id: string; order_id: string; recipient_kind: "customer" | "admin"; recipient_email: string | null; attempt_count: number }>;
  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const job of jobs) {
    try {
      const { data: order, error: orderError } = await admin.from("orders").select("id,order_number,status,total_minor,currency,shipping_method,shipping_snapshot,customer_snapshot,order_items(item_type,title,quantity,total_minor,review_reason)").eq("id", job.order_id).single();
      if (orderError || !order) throw new Error(orderError?.message || "Pedido inexistente.");
      const customerEmail = String((order.customer_snapshot as Record<string, unknown>)?.email || "");
      const recipients = job.recipient_kind === "admin" ? adminEmails : [job.recipient_email || customerEmail].filter(Boolean);
      if (!recipients.length) throw new Error("El destinatario no tiene correo.");
      const message = buildCommerceEmail(job, order as EmailOrder, (order.order_items || []) as EmailOrderItem[], siteUrl);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
          "Idempotency-Key": `matearte/commerce/${job.id}`,
        },
        body: JSON.stringify({ from: emailFrom, to: recipients, subject: message.subject, html: message.html, reply_to: replyTo }),
      });
      const value = await response.json().catch(() => ({})) as { id?: unknown; message?: unknown; error?: unknown };
      if (!response.ok || typeof value.id !== "string") throw new Error(typeof value.message === "string" ? value.message : typeof value.error === "string" ? value.error : "El proveedor rechazó el correo.");
      await admin.from("commerce_email_outbox").update({ status: "sent", provider_message_id: value.id, sent_at: new Date().toISOString(), last_error: null }).eq("id", job.id).eq("status", "sending");
      results.push({ id: job.id, status: "sent" });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "No se pudo enviar el correo.";
      const exhausted = job.attempt_count >= 5;
      await admin.from("commerce_email_outbox").update({
        status: "failed",
        last_error: message,
        available_at: exhausted ? "9999-12-31T00:00:00.000Z" : new Date(Date.now() + Math.min(30, 2 ** job.attempt_count) * 60_000).toISOString(),
      }).eq("id", job.id).eq("status", "sending");
      results.push({ id: job.id, status: "failed", error: message });
    }
  }

  return json({ processed: results.length, results });
});
