export type LifecycleTemplateJob = {
  recipient_email: string;
  payload: Record<string, unknown>;
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const normalizedSiteUrl = (siteUrl: string) => siteUrl.replace(/\/$/, "");

const brandHeader = (siteUrl: string) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0">
  <tr>
    <td align="center" valign="middle" height="116" style="height:116px;border-bottom:1px solid #bfab8c">
      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0">
        <tr>
          <td width="56" height="56" style="width:56px;height:56px">
            <img src="${escapeHtml(normalizedSiteUrl(siteUrl))}/assets/matearte/home-v2/logo.png" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border:0;object-fit:cover">
          </td>
          <td valign="middle" style="padding-left:16px;text-align:left">
            <div class="brand-name" style="color:#311c12;font-family:'Newsreader',Georgia,serif;font-size:30px;font-weight:500;line-height:34px;white-space:nowrap">MateArte</div>
            <div class="brand-tagline" style="color:#79452d;font-family:'Outfit',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:2.34px;line-height:16px;text-transform:uppercase;white-space:nowrap">ARTE &amp; TRADICIÓN</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

const layout = (content: string, siteUrl: string) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:wght@500&amp;family=Outfit:wght@400;600&amp;display=swap" rel="stylesheet">
  <style>@media only screen and (max-width:680px){.email-wrap{padding:12px!important}.email-body{padding:24px!important}.brand-name{font-size:27px!important}.brand-tagline{font-size:11px!important;letter-spacing:1.8px!important}}</style>
</head>
<body style="margin:0;background:#f4f4f4;color:#311c12;font-family:'Outfit',Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-wrap" style="width:100%;background:#f4f4f4;padding:28px 12px;border-collapse:separate;border-spacing:0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#fffdf8;border:1px solid #bfab8c;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden">
        <tr><td>${brandHeader(siteUrl)}</td></tr>
        <tr><td class="email-body" style="padding:32px">${content}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const heading = (title: string) => `<h1 style="margin:0 0 16px;color:#311c12;font-family:'Newsreader',Georgia,serif;font-size:32px;font-weight:500;line-height:1.18">${escapeHtml(title)}</h1>`;

const copy = (text: string) => `<div style="margin:0 0 16px;color:#79452d;font-family:'Outfit',Arial,sans-serif;font-size:16px;font-weight:400;line-height:1.35">${text}</div>`;

const summaryRow = (label: string, value: string) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;height:30px;margin:0 0 16px;border-collapse:separate;border-spacing:0">
  <tr>
    <td valign="middle" style="color:#79452d;font-family:'Outfit',Arial,sans-serif;font-size:15px;font-weight:400;line-height:20px">${escapeHtml(label)}</td>
    <td align="right" valign="middle" style="color:#311c12;font-family:'Outfit',Arial,sans-serif;font-size:16px;font-weight:600;line-height:20px;white-space:nowrap">${escapeHtml(value)}</td>
  </tr>
</table>`;

const button = (label: string, url: string) => `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0;border-collapse:separate;border-spacing:0"><tr><td style="background:#79452d;border-radius:4px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;color:#fffdf8;font-family:'Outfit',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:1.04px;line-height:16px;text-decoration:none;text-transform:uppercase;white-space:nowrap">${escapeHtml(label.toUpperCase())}</a></td></tr></table>`;

const payloadString = (payload: Record<string, unknown>, key: string) => typeof payload[key] === "string"
  ? String(payload[key]).trim()
  : "";

export function buildWelcomeEmail(job: LifecycleTemplateJob, siteUrl: string) {
  const name = payloadString(job.payload, "name");
  const greeting = name ? `Hola ${escapeHtml(name)}!` : "¡Hola!";

  return {
    subject: "Bienvenido a MateArte",
    html: layout(
      `${heading("Bienvenida a MateArte")}${copy(`${greeting} Tu cuenta ya está pronta. Desde ahora podés guardar tus datos, seguir pedidos y guardar tus mates personalizados más fácilmente.`)}${summaryRow("Pedidos", "Seguimiento en un solo lugar")}${summaryRow("Datos", "Compra más rápida")}${summaryRow("Personalizados", "Guardá tus mates personalizados")}${button("Ir a mi cuenta", `${normalizedSiteUrl(siteUrl)}/perfil`)}`,
      siteUrl,
    ),
  };
}

export function buildBirthdayEmail(job: LifecycleTemplateJob, siteUrl: string) {
  const name = payloadString(job.payload, "name");
  const discountCode = payloadString(job.payload, "discountCode") || "—";
  const discountPercent = payloadString(job.payload, "discountPercent") || "20%";
  const validity = payloadString(job.payload, "discountValidity") || "30 días desde ahora";
  const subject = name ? `Se acerca tu cumpleaños, ${name}` : "Se acerca tu cumpleaños";

  return {
    subject,
    html: layout(
      `${heading("Se acerca tu cumpleaños")}${copy("Queremos acompañarte en tu día con un regalo especial para vos. Por eso te queremos ofrecer este descuento de 20% en tu compra de mates personalizados.")}${summaryRow("Código", discountCode)}${summaryRow("Descuento", discountPercent)}${summaryRow("Validez", validity)}${button("Ver personalizados", `${normalizedSiteUrl(siteUrl)}/personalizados`)}`,
      siteUrl,
    ),
  };
}
