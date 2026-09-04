export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://matearte.uy").replace(/\/$/, "");

export function absoluteUrl(path = "/") {
  return new URL(path, siteUrl).toString();
}
