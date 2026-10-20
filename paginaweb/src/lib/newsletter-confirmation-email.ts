const subject = "Confirmá tu correo y activá tu 10%";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

export function newsletterConfirmationEmail(confirmUrl: string, siteOrigin: string) {
  const url = escapeHtml(confirmUrl);
  const logoUrl = escapeHtml(`${siteOrigin.replace(/\/$/, "")}/assets/matearte/01-marca/email-monogram.png`);

  return {
    subject,
    text: `Un paso más para tu 10%\n\nConfirmá tu correo para crear tu cuenta y activar el descuento de bienvenida en tu primera compra.\n\nTu beneficio: 10% en tu primera compra\n\nConfirmar correo: ${confirmUrl}\n\nSi no solicitaste este beneficio, podés ignorar este mensaje.`,
    html: `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${subject}</title>
    <style>
      @media only screen and (max-width: 640px) {
        .email-card { width: 100% !important; }
        .email-body { padding: 28px 24px !important; }
        .email-title { font-size: 28px !important; line-height: 32px !important; }
        .email-benefit { display: block !important; text-align: left !important; padding-top: 4px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:24px 12px;background-color:#f5f5f5;color:#311c12;">
    <div style="display:none;font-size:1px;line-height:1px;color:#f5f5f5;max-height:0;max-width:0;opacity:0;overflow:hidden;">Confirmá tu correo y activá el 10% de bienvenida en tu primera compra.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="email-card" style="width:100%;max-width:640px;border:1px solid #bfab8c;border-radius:8px;background-color:#fffdf8;border-collapse:separate;overflow:hidden;">
      <tr>
        <td align="center" style="padding:29px 24px;border-bottom:1px solid #bfab8c;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding-right:16px;vertical-align:middle;"><img src="${logoUrl}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border:0;"></td>
              <td style="vertical-align:middle;text-align:left;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:500;line-height:34px;color:#311c12;">MateArte</div>
                <div style="margin-top:2px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;line-height:16px;letter-spacing:2.34px;color:#79452d;">ARTE &amp; TRADICIÓN</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="email-body" style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#79452d;">
          <h1 class="email-title" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:500;line-height:36px;color:#311c12;">Un paso más para tu 10%</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:22px;">Confirmá tu correo para crear tu cuenta y activar el descuento de bienvenida en tu primera compra.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 16px;border-collapse:collapse;">
            <tr>
              <td style="font-size:15px;line-height:30px;color:#79452d;">Tu beneficio</td>
              <td class="email-benefit" align="right" style="font-size:16px;font-weight:600;line-height:30px;color:#311c12;">10% en tu primera compra</td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border-collapse:separate;">
            <tr><td style="background-color:#79452d;border-radius:4px;"><a href="${url}" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;line-height:16px;letter-spacing:1.04px;text-decoration:none;color:#fffdf8;">CONFIRMAR CORREO</a></td></tr>
          </table>
          <p style="margin:0;font-size:14px;line-height:20px;">Si no solicitaste este beneficio, podés ignorar este mensaje.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
