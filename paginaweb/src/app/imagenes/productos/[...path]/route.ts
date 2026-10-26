import { supabaseUrl } from "@/lib/supabase/config";

type ProductImageParams = { params: Promise<{ path: string[] }> };

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

function imagePath(segments: string[]) {
  if (!segments.length || segments.some((part) => !part || part === "." || part === ".." || /[\\/\u0000-\u001f]/.test(part))) return null;
  return segments.map(encodeURIComponent).join("/");
}

async function serveImage({ params }: ProductImageParams, method: "GET" | "HEAD") {
  const encodedPath = imagePath((await params).path);
  if (!encodedPath) return new Response(null, { status: 404 });

  const upstreamUrl = `${supabaseUrl().replace(/\/$/, "")}/storage/v1/object/public/product-images/${encodedPath}`;
  let upstream: Response;
  try {
    // Product files can exceed Next's 2 MB data-cache limit; cache the public response at the CDN instead.
    upstream = await fetch(upstreamUrl, { method, cache: "no-store" });
  } catch {
    return new Response(null, { status: 502 });
  }
  if (!upstream.ok) return new Response(null, { status: upstream.status < 500 ? 404 : 502 });

  const contentType = upstream.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!contentType || !allowedImageTypes.has(contentType)) {
    await upstream.body?.cancel();
    return new Response(null, { status: 415 });
  }

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    "X-Content-Type-Options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(method === "HEAD" ? null : upstream.body, { status: 200, headers });
}

export async function GET(_request: Request, context: ProductImageParams) {
  return serveImage(context, "GET");
}

export async function HEAD(_request: Request, context: ProductImageParams) {
  return serveImage(context, "HEAD");
}
