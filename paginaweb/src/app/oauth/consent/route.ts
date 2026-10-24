import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const authorizationId = request.nextUrl.searchParams.get("authorization_id");
  if (!authorizationId || authorizationId.length > 512) {
    return new Response("Solicitud de autorización inválida.", { status: 400 });
  }

  const destination = new URL("https://matearte-gestion.vercel.app/oauth/consent");
  destination.searchParams.set("authorization_id", authorizationId);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
