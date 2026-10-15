import { ruralCityOptions, ruralCountryOptions } from "@/lib/rural-locations";

export const runtime = "nodejs";

export function GET(request: Request) {
  const url = new URL(request.url);
  const countryCode = (url.searchParams.get("country") || "").toUpperCase();
  const query = (url.searchParams.get("q") || "").slice(0, 80);
  if (!ruralCountryOptions.some(({ code }) => code === countryCode)) {
    return Response.json({ error: "País no disponible." }, { status: 400 });
  }

  return Response.json(ruralCityOptions(countryCode, query), {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
