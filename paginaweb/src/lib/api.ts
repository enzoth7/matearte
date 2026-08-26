import { NextResponse } from "next/server";

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error("Se esperaba application/json.");
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("JSON inválido.");
  return value as Record<string, unknown>;
}
