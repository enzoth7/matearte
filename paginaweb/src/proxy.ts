import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "@/i18n/config";
import { routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo se redirige la portada cuando la persona eligió otro idioma. El idioma del navegador ya no
  // redirige: los buscadores siempre ven la portada en español y el aviso de idioma sugiere el cambio.
  if (pathname === "/") {
    const saved = request.cookies.get("NEXT_LOCALE")?.value;
    if (isLocale(saved) && saved !== "es") {
      const target = request.nextUrl.clone();
      target.pathname = `/${saved}`;
      return NextResponse.redirect(target);
    }
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: "/((?!api|auth|oauth|_next|_vercel|sorteo(?:/|$)|.*\\..*).*)",
};
