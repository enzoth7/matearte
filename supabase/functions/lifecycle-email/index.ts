import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { buildBirthdayEmail, buildWelcomeEmail } from "./templates.ts";

type LifecycleJob = {
  id: string;
  event_type: "welcome" | "birthday";
  recipient_email: string;
  payload: Record<string, unknown>;
  attempt_count: number;
};

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
  const siteUrl = (Deno.env.get("MATEARTE_SITE_URL") || config.matearte_site_url || "https://www.matearteuruguay.com").trim().replace(/\/$/, "");
  const missing = [
    !resendApiKey && "RESEND_API_KEY",
    !emailFrom && "COMMERCE_EMAIL_FROM",
    !replyTo && "COMMERCE_EMAIL_REPLY_TO",
  ].filter(Boolean);
  if (missing.length) return json({ error: "Los correos de ciclo de vida todavía no están configurados.", missing }, 503);

  const queued = await admin.rpc("queue_upcoming_birthday_emails", {});
  if (queued.error) return json({ error: queued.error.message }, 500);
  const claim = await admin.rpc("claim_lifecycle_email_jobs", { p_limit: 20 });
  if (claim.error) return json({ error: claim.error.message }, 500);

  const jobs = (claim.data || []) as LifecycleJob[];
  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const job of jobs) {
    try {
      const message = job.event_type === "welcome"
        ? buildWelcomeEmail(job, siteUrl)
        : buildBirthdayEmail(job, siteUrl);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
          "Idempotency-Key": `matearte/lifecycle/${job.id}`,
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [job.recipient_email],
          subject: message.subject,
          html: message.html,
          reply_to: replyTo,
        }),
      });
      const value = await response.json().catch(() => ({})) as { id?: unknown; message?: unknown; error?: unknown };
      if (!response.ok || typeof value.id !== "string") {
        throw new Error(typeof value.message === "string" ? value.message : typeof value.error === "string" ? value.error : "El proveedor rechazó el correo.");
      }
      await admin.from("lifecycle_email_outbox").update({
        status: "sent",
        provider_message_id: value.id,
        sent_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", job.id).eq("status", "sending");
      results.push({ id: job.id, status: "sent" });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "No se pudo enviar el correo.";
      const exhausted = job.attempt_count >= 5;
      await admin.from("lifecycle_email_outbox").update({
        status: "failed",
        last_error: message,
        available_at: exhausted ? "9999-12-31T00:00:00.000Z" : new Date(Date.now() + Math.min(30, 2 ** job.attempt_count) * 60_000).toISOString(),
      }).eq("id", job.id).eq("status", "sending");
      results.push({ id: job.id, status: "failed", error: message });
    }
  }

  return json({ queuedBirthdays: queued.data || 0, processed: results.length, results });
});
