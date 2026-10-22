const defaultSiteUrl = "https://www.matearteuruguay.com";

function resolveSiteUrl() {
  for (const raw of [process.env.SITE_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    const candidate = raw?.replace(/(\\r|\\n)/g, "").trim().replace(/\/$/, "");
    if (!candidate) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      // Valor inválido: probar el siguiente o caer al default.
    }
  }
  return defaultSiteUrl;
}

export const siteUrl = resolveSiteUrl();

export function absoluteUrl(path = "/") {
  return new URL(path, siteUrl).toString();
}
