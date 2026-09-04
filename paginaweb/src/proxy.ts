import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "@/i18n/config";
import { routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

function browserLocale(request: NextRequest) {
  const preferred = request.headers.get("accept-language")?.toLowerCase() ?? "";
  const candidates = preferred.split(",").map((entry, index) => {
    const [tag, ...parameters] = entry.trim().split(";");
    const quality = Number(parameters.find((value) => value.trim().startsWith("q="))?.split("=")[1] ?? "1");
    return { tag, quality: Number.isFinite(quality) ? quality : 0, index };
  }).sort((left, right) => right.quality - left.quality || left.index - right.index);
  for (const { tag } of candidates) {
    if (tag === "pt" || tag.startsWith("pt-")) return "pt";
    if (tag === "en" || tag.startsWith("en-")) return "en";
    if (tag === "es" || tag.startsWith("es-")) return "es";
  }
  return "es";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const saved = request.cookies.get("NEXT_LOCALE")?.value;
    const locale = isLocale(saved) ? saved : browserLocale(request);
    if (locale !== "es") {
      const target = request.nextUrl.clone();
      target.pathname = `/${locale}`;
      const response = NextResponse.redirect(target);
      response.cookies.set("NEXT_LOCALE", locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
      return response;
    }
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: "/((?!api|auth|_next|_vercel|.*\\..*).*)",
};
