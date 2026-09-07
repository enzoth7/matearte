import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

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

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const base64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
};

async function unsubscribeToken(email: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(email))));
}

const layout = (content: string, footer: string) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f5efe3;color:#24150f;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5efe3;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fffdf8;border:1px solid #ddccb5">
        <tr><td style="background:#351d13;padding:24px 32px;color:#fff">
          <div style="font-family:Georgia,serif;font-size:28px;font-weight:bold">MateArte</div>
          <div style="margin-top:4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#e6d2b5">Arte &amp; tradición</div>
        </td></tr>
        <tr><td style="padding:34px 32px">${content}</td></tr>
        <tr><td style="border-top:1px solid #e7dac8;padding:22px 32px;color:#735947;font-size:12px;line-height:1.6">${footer}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const button = (label: string, url: string) => `<p style="margin:28px 0 6px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#351d13;color:#fff;text-decoration:none;padding:14px 22px;font-weight:bold">${escapeHtml(label)}</a></p>`;

function welcomeEmail(job: LifecycleJob, siteUrl: string) {
  const name = String(job.payload?.name || "").trim();
  const greeting = name ? `Hola ${escapeHtml(name)},` : "Hola,";
  return {
    subject: "Bienvenido a MateArte",
    html: layout(`
      <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:34px;line-height:1.15">Bienvenido a MateArte</h1>
      <p style="font-size:16px;line-height:1.7">${greeting}</p>
      <p style="font-size:16px;line-height:1.7">Gracias por crear tu cuenta en MateArte.</p>
      <p style="font-size:16px;line-height:1.7">Desde tu perfil vas a poder guardar tus diseños personalizados, consultar tus pedidos y mantener tus datos listos para futuras compras.</p>
      ${button("Ir a mi cuenta", `${siteUrl}/perfil`)}
      <p style="font-size:16px;line-height:1.7">Cada pieza MateArte nace de un oficio familiar, trabajado en Paysandú con dedicación y atención a los detalles.</p>
      <p style="font-size:16px;line-height:1.7">Gracias por acompañarnos.</p>
      <p style="font-size:16px;line-height:1.7"><strong>MateArte</strong><br>Arte &amp; Tradición</p>
    `, "Si no reconocés este registro, respondé este correo y te ayudamos."),
  };
}

async function birthdayEmail(job: LifecycleJob, siteUrl: string, unsubscribeSecret: string) {
  const name = String(job.payload?.name || "").trim();
  const greeting = name ? `Hola ${escapeHtml(name)},` : "Hola,";
  const subject = name ? `Se acerca tu cumpleaños, ${name}` : "Se acerca tu cumpleaños";
  const email = job.recipient_email.toLowerCase();
  const token = await unsubscribeToken(email, unsubscribeSecret);
  const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  return {
    subject,
    html: layout(`
      <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:34px;line-height:1.15">Se acerca tu cumpleaños</h1>
      <p style="font-size:16px;line-height:1.7">${greeting}</p>
      <p style="font-size:16px;line-height:1.7">Faltan pocos días para tu cumpleaños y queríamos estar presentes en este momento especial.</p>
      <p style="font-size:16px;line-height:1.7">Si estás pensando en una pieza para vos o en un regalo con identidad, te invitamos a explorar nuestra colección.</p>
      ${button("Explorar colección", `${siteUrl}/catalogo`)}
      <p style="font-size:16px;line-height:1.7">Cada pieza se trabaja artesanalmente en Paysandú, cuidando cada detalle.</p>
    `, `Recibís este correo porque aceptaste las novedades de MateArte. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#735947">Podés darte de baja cuando quieras</a>.`),
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

async function hasNewsletterConsent(email: string, apiKey: string, topicId: string) {
  const encoded = encodeURIComponent(email);
  const headers = { Authorization: `Bearer ${apiKey}` };
  const contactResponse = await fetch(`https://api.resend.com/contacts/${encoded}`, { headers });
  if (contactResponse.status === 404) return false;
  if (!contactResponse.ok) throw new Error(`No se pudo consultar el contacto en Resend (${contactResponse.status}).`);
  const contact = await contactResponse.json() as { unsubscribed?: unknown };
  if (contact.unsubscribed === true) return false;

  const topicsResponse = await fetch(`https://api.resend.com/contacts/${encoded}/topics`, { headers });
  if (topicsResponse.status === 404) return false;
  if (!topicsResponse.ok) throw new Error(`No se pudo consultar el topic en Resend (${topicsResponse.status}).`);
  const topics = await topicsResponse.json() as { data?: Array<{ id?: unknown; subscription?: unknown }> };
  return (topics.data || []).some((topic) => topic.id === topicId && topic.subscription === "opt_in");
}

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
  const topicId = Deno.env.get("RESEND_NEWSLETTER_TOPIC_ID")?.trim() || config.matearte_newsletter_topic_id;
  const unsubscribeSecret = Deno.env.get("NEWSLETTER_UNSUBSCRIBE_SECRET")?.trim() || config.matearte_newsletter_unsubscribe_secret;
  const siteUrl = (Deno.env.get("MATEARTE_SITE_URL") || config.matearte_site_url || "https://www.matearteuruguay.com").trim().replace(/\/$/, "");
  const missing = [
    !resendApiKey && "RESEND_API_KEY",
    !emailFrom && "COMMERCE_EMAIL_FROM",
    !replyTo && "COMMERCE_EMAIL_REPLY_TO",
    !topicId && "RESEND_NEWSLETTER_TOPIC_ID",
    !unsubscribeSecret && "NEWSLETTER_UNSUBSCRIBE_SECRET",
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
      if (job.event_type === "birthday" && !await hasNewsletterConsent(job.recipient_email, resendApiKey!, topicId!)) {
        await admin.from("lifecycle_email_outbox").update({
          status: "skipped",
          last_error: "El contacto no tiene consentimiento vigente para el topic Novedades.",
        }).eq("id", job.id).eq("status", "sending");
        results.push({ id: job.id, status: "skipped" });
        continue;
      }

      const message = job.event_type === "welcome" ? welcomeEmail(job, siteUrl) : await birthdayEmail(job, siteUrl, unsubscribeSecret!);
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
          ...(message.headers ? { headers: message.headers } : {}),
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
