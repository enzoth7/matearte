import { verifyNewsletterUnsubscribeToken } from "@/lib/newsletter-unsubscribe";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const html = (title: string, message: string, form = "") => new Response(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} · MateArte</title></head>
<body style="margin:0;background:#f5efe3;color:#24150f;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box">
  <main style="max-width:520px;background:#fffdf8;border:1px solid #ddccb5;padding:36px">
    <div style="font-family:Georgia,serif;font-size:30px;font-weight:bold">MateArte</div>
    <h1 style="font-family:Georgia,serif;font-size:28px">${title}</h1>
    <p style="font-size:16px;line-height:1.6">${message}</p>${form}
  </main>
</body></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

function requestData(request: Request) {
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase().slice(0, 320);
  const token = (url.searchParams.get("token") || "").trim();
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const topicId = process.env.RESEND_NEWSLETTER_TOPIC_ID?.trim() || "";
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET?.trim() || "";
  const valid = emailPattern.test(email) && token && apiKey && topicId && secret
    && verifyNewsletterUnsubscribeToken(email, token, secret);
  return { email, token, apiKey, topicId, valid: Boolean(valid) };
}

export async function GET(request: Request) {
  const data = requestData(request);
  if (!data.valid) return html("Enlace no válido", "El enlace de baja no es válido. Podés responder el correo y te ayudamos.");
  const action = new URL(request.url);
  return html(
    "¿Querés dejar de recibir Novedades?",
    "Tu cuenta y los correos sobre pedidos seguirán funcionando normalmente.",
    `<form method="post" action="${action.pathname}${action.search}"><button type="submit" style="border:0;background:#351d13;color:#fff;padding:14px 22px;font-weight:bold;cursor:pointer">Dar de baja Novedades</button></form>`,
  );
}

export async function POST(request: Request) {
  const data = requestData(request);
  if (!data.valid) return html("Enlace no válido", "No pudimos validar este enlace. Podés responder el correo y te ayudamos.");
  const response = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(data.email)}/topics`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${data.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ topics: [{ id: data.topicId, subscription: "opt_out" }] }),
    cache: "no-store",
  });
  if (!response.ok && response.status !== 404) {
    return html("No pudimos completar la baja", "Intentá nuevamente en unos minutos o respondé el correo y te ayudamos.");
  }
  return html("Baja confirmada", "Ya no vas a recibir correos comerciales de Novedades. Los correos necesarios sobre tu cuenta y tus pedidos no se ven afectados.");
}

export const dynamic = "force-dynamic";
