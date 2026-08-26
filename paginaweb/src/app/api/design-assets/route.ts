import { createHash } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { isAllowedCustomizerOrigin } from "@/lib/supabase/config";
import { createTokenSupabase } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cors = (origin: string) => ({ "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" });

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return origin && isAllowedCustomizerOrigin(origin) ? new Response(null, { status: 204, headers: cors(origin) }) : new Response(null, { status: 403 });
}

function sanitizeSvg(source: string) {
  if (!/^\s*<svg[\s>]/i.test(source) || /<(?:script|foreignObject|iframe|object|embed)\b/i.test(source) || /\b(?:href|xlink:href)\s*=\s*["'](?!#)/i.test(source) || /url\s*\(\s*["']?(?:https?:|\/\/)/i.test(source)) throw new Error("El SVG contiene contenido externo o no permitido.");
  const clean = sanitizeHtml(source, {
    allowedTags: ["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "defs", "lineargradient", "radialgradient", "stop", "clippath", "mask", "title", "desc", "text", "tspan"],
    allowedAttributes: { '*': ["id", "class", "transform", "fill", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "viewbox", "points", "offset", "stop-color", "stop-opacity", "clip-path", "mask", "xmlns", "preserveaspectratio", "font-size", "font-family", "text-anchor"] },
    allowedSchemes: [], allowProtocolRelative: false,
  });
  if (!clean.includes("<svg")) throw new Error("El SVG quedó vacío después de sanitizarlo.");
  return clean;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !isAllowedCustomizerOrigin(origin)) return apiError("Origen no permitido.", 403);
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return apiError("Falta la sesión.", 401);
  const client = createTokenSupabase(accessToken);
  const { data: { user } } = await client.auth.getUser(accessToken);
  if (!user) return apiError("La sesión no es válida.", 401);
  try {
    const form = await request.formData();
    const file = form.get("file"), designId = String(form.get("designId") || ""), assetId = String(form.get("assetId") || "");
    if (!(file instanceof File) || !uuid.test(designId) || !/^upload-[0-9a-f-]{36}$/i.test(assetId)) return apiError("Archivo o diseño inválido.");
    if (file.size < 1 || file.size > 5 * 1024 * 1024) return apiError("El archivo debe pesar entre 1 byte y 5 MB.", 413);
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) return apiError("Tipo de archivo no permitido.", 415);
    const { data: design } = await client.from("designs").select("id").eq("id", designId).eq("user_id", user.id).maybeSingle();
    if (!design) return apiError("El diseño no existe o no te pertenece.", 404);
    let bytes = Buffer.from(await file.arrayBuffer());
    if (file.type === "image/png" && bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("El PNG no tiene una firma válida.");
    if (file.type === "image/jpeg" && bytes.subarray(0, 3).toString("hex") !== "ffd8ff") throw new Error("El JPEG no tiene una firma válida.");
    if (file.type === "image/svg+xml") bytes = Buffer.from(sanitizeSvg(bytes.toString("utf8")), "utf8");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const existing = await client.from("design_assets").select("object_path").eq("design_id", designId).eq("user_id", user.id).eq("sha256", sha256).maybeSingle();
    if (existing.data) {
      const response = NextResponse.json({ objectPath: existing.data.object_path, storageRef: `storage:design-assets:${existing.data.object_path}` });
      Object.entries(cors(origin)).forEach(([key, value]) => response.headers.set(key, value)); return response;
    }
    const extension = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "svg";
    const objectPath = `${user.id}/${designId}/${assetId}-${sha256.slice(0, 12)}.${extension}`;
    const uploaded = await client.storage.from("design-assets").upload(objectPath, bytes, { contentType: file.type, upsert: false, cacheControl: "31536000" });
    if (uploaded.error) throw uploaded.error;
    const metadata = await client.from("design_assets").insert({ design_id: designId, user_id: user.id, bucket_id: "design-assets", object_path: objectPath, original_name: file.name.slice(0, 240), mime_type: file.type, byte_size: bytes.length, sha256 });
    if (metadata.error) { await client.storage.from("design-assets").remove([objectPath]); throw metadata.error; }
    const response = NextResponse.json({ objectPath, storageRef: `storage:design-assets:${objectPath}` }, { status: 201 });
    Object.entries(cors(origin)).forEach(([key, value]) => response.headers.set(key, value)); return response;
  } catch (error) { return apiError(error instanceof Error ? error.message : "No se pudo almacenar el archivo.", 400); }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
