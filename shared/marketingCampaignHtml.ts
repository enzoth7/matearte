export type MarketingCampaignMode = "message" | "image";

export type MarketingCampaignContent = {
  mode: MarketingCampaignMode;
  subject: string;
  headline?: string | null;
  body: string;
  button_label?: string | null;
  image_url: string | null;
  target_url: string | null;
  discount_code?: string | null;
  utm_campaign?: string | null;
};

// Marca los enlaces a matearteuruguay.com para ver de qué campaña llegó cada visita.
export function campaignLink(url: string | null, utmCampaign?: string | null) {
  if (!url || !/^https:\/\//i.test(url)) return "";
  if (!utmCampaign) return url;
  try {
    const link = new URL(url);
    if (!/(^|\.)matearteuruguay\.com$/.test(link.hostname)) return url;
    link.searchParams.set("utm_source", "email");
    link.searchParams.set("utm_medium", "campaign");
    link.searchParams.set("utm_campaign", utmCampaign);
    return link.toString();
  } catch { return url; }
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char] || char);

const logoUrl = "https://www.matearteuruguay.com/assets/matearte/home-v2/logo.png";

export function marketingCampaignHtml(campaign: MarketingCampaignContent, test = false) {
  const targetUrl = escapeHtml(campaignLink(campaign.target_url, campaign.utm_campaign));
  const image = campaign.image_url
    ? `<img src="${escapeHtml(campaign.image_url)}" alt="" width="576" style="display:block;width:100%;max-width:576px;height:auto;border:0">`
    : "";
  const footer = test ? "Esta es una prueba de la campaña." : '<a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#79452d;text-decoration:underline">Cancelar suscripción</a>';

  if (campaign.mode === "image") {
    const linkedImage = targetUrl ? `<a href="${targetUrl}" style="display:block;text-decoration:none">${image}</a>` : image;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f0e8;color:#302018;font-family:Arial,sans-serif"><main style="max-width:600px;margin:auto;padding:0;background:#fffdf9">${linkedImage}<p style="margin:32px 16px 0;padding-bottom:20px;font-size:11px;color:#695950">${footer}</p></main></body></html>`;
  }

  const title = escapeHtml((campaign.headline || campaign.subject).trim());
  const paragraphs = campaign.body.trim().split(/\n{2,}/).filter(Boolean)
    .map((part) => `<p style="margin:0 0 16px;color:#79452d;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.4">${escapeHtml(part).replace(/\n/g, "<br>")}</p>`).join("");
  const code = campaign.discount_code && /^[A-Z0-9][A-Z0-9_-]{3,31}$/.test(campaign.discount_code)
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:separate"><tr><td style="padding:12px 20px;border:1px dashed #79452d;border-radius:6px;background:#f6f0e8;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#79452d">Tu código de descuento<br><strong style="font-size:22px;letter-spacing:2px;color:#311c12">${escapeHtml(campaign.discount_code)}</strong></td></tr></table>`
    : "";
  const button = targetUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 0;border-collapse:separate"><tr><td style="background:#79452d;border-radius:4px"><a href="${targetUrl}" style="display:inline-block;padding:12px 24px;color:#fffdf8;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:1.04px;line-height:16px;text-decoration:none;text-transform:uppercase">${escapeHtml((campaign.button_label || "Ver más").trim().toUpperCase())}</a></td></tr></table>`
    : "";
  const brand = `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td style="padding-right:16px;vertical-align:middle"><img src="${logoUrl}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border:0"></td><td style="vertical-align:middle;text-align:left"><div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:34px;color:#311c12">MateArte</div><div style="margin-top:2px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;line-height:16px;letter-spacing:2.34px;color:#79452d">ARTE &amp; TRADICIÓN</div></td></tr></table>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:640px){.email-wrap{padding:12px!important}.email-body{padding:28px 24px!important}.email-title{font-size:28px!important;line-height:32px!important}}</style></head><body style="margin:0;background:#f5f5f5;color:#311c12;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-wrap" style="width:100%;background:#f5f5f5;padding:24px 12px;border-collapse:separate;border-spacing:0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#fffdf8;border:1px solid #bfab8c;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden"><tr><td align="center" style="padding:29px 24px;border-bottom:1px solid #bfab8c">${brand}</td></tr><tr><td class="email-body" style="padding:32px"><h1 class="email-title" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:500;line-height:36px;color:#311c12">${title}</h1>${paragraphs}${code}${image ? `<div style="margin:8px 0 20px">${image}</div>` : ""}${button}<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e6dacf;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#79452d">${footer}</p></td></tr></table></td></tr></table></body></html>`;
}
