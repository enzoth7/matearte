import DOMPurify from "dompurify";
import { convertRasterToWebp } from "./convertRasterToWebp";

const MAX_ICON_BYTES = 2 * 1024 * 1024;

export async function preparePersonalizerIcon(file: File): Promise<{ file: File; extension: "svg" | "webp" }> {
  if (!file.size || file.size > MAX_ICON_BYTES)
    throw new Error("Elegí un SVG, PNG o WebP de hasta 2 MB.");

  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
    const source = await file.text();
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    if (parsed.documentElement.localName !== "svg" || parsed.querySelector("parsererror"))
      throw new Error("El archivo SVG no tiene un formato válido.");

    const cleaned = DOMPurify.sanitize(source, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["a", "animate", "animateMotion", "animateTransform", "foreignObject", "image", "script", "set", "style", "use"],
      FORBID_ATTR: ["href", "xlink:href", "style"],
    });
    const safe = new DOMParser().parseFromString(cleaned, "image/svg+xml");
    if (safe.documentElement.localName !== "svg" || safe.querySelector("parsererror") || !safe.querySelector("path,rect,circle,ellipse,line,polygon,polyline,text"))
      throw new Error("El SVG no contiene formas visibles compatibles.");
    for (const element of safe.querySelectorAll("*")) {
      for (const attribute of element.attributes) {
        if (/url\s*\(/i.test(attribute.value) && !/^url\(\s*['"]?#[a-zA-Z0-9_-]+['"]?\s*\)$/.test(attribute.value.trim()))
          throw new Error("El SVG contiene referencias externas. Guardalo con las formas incorporadas.");
      }
    }
    return { file: new File([cleaned], file.name.replace(/\.[^.]+$/, "") + ".svg", { type: "image/svg+xml" }), extension: "svg" };
  }

  if (file.type !== "image/png" && file.type !== "image/webp")
    throw new Error("Elegí un SVG, PNG o WebP de hasta 2 MB.");
  const image = await createImageBitmap(file);
  const { width, height } = image;
  image.close();
  if (width < 256 || height < 256 || width > 4096 || height > 4096)
    throw new Error("El ícono debe medir entre 256 y 4096 píxeles por lado.");
  return { file: await convertRasterToWebp(file, 1, MAX_ICON_BYTES), extension: "webp" };
}
