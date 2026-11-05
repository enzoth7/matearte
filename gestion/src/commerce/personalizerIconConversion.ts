import DOMPurify from "dompurify";

export type IconOutputFormat = "svg" | "webp";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 32_000_000;

function outputName(name: string, extension: IconOutputFormat) {
  return `${name.replace(/\.[^.]+$/, "")}.${extension}`;
}

function sanitizeSvg(source: string): string {
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
  return cleaned;
}

async function decodeSvg(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo leer el archivo SVG."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeTiff(file: File): Promise<ImageBitmap> {
  const { default: UTIF } = await import("utif");
  const buffer = await file.arrayBuffer();
  const pages = UTIF.decode(buffer);
  const first = pages[0];
  const width = first?.t256?.[0];
  const height = first?.t257?.[0];
  if (!width || !height || width * height > MAX_SOURCE_PIXELS)
    throw new Error("La imagen TIFF no tiene dimensiones válidas o es demasiado grande.");
  UTIF.decodeImage(buffer, first);
  const rgba = UTIF.toRGBA8(first);
  const canvas = document.createElement("canvas");
  canvas.width = first.width;
  canvas.height = first.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la imagen TIFF.");
  context.putImageData(new ImageData(new Uint8ClampedArray(rgba), first.width, first.height), 0, 0);
  return createImageBitmap(canvas);
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) return decodeSvg(file);
  if (/\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]$/i.test(file.type)) {
    const { default: heic2any } = await import("heic2any");
    const result = await heic2any({ blob: file, toType: "image/png" });
    return createImageBitmap(Array.isArray(result) ? result[0] : result);
  }
  if (/\.(tif|tiff)$/i.test(file.name) || file.type === "image/tiff") return decodeTiff(file);
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error("No se pudo abrir esta imagen. Probá con JPG, PNG, WebP, GIF, BMP, AVIF, HEIC o TIFF.");
  }
}

function drawImage(image: ImageBitmap | HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const width = image.width || (image instanceof HTMLImageElement ? image.naturalWidth : 0);
  const height = image.height || (image instanceof HTMLImageElement ? image.naturalHeight : 0);
  if (!width || !height || width * height > MAX_SOURCE_PIXELS)
    throw new Error("La imagen no tiene dimensiones válidas o es demasiado grande.");
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la imagen.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (!blob || blob.type !== "image/webp") reject(new Error("Este navegador no pudo convertir la imagen a WebP."));
    else resolve(blob);
  }, "image/webp", quality));
}

async function rasterToWebp(image: ImageBitmap | HTMLImageElement, name: string): Promise<File> {
  const canvas = drawImage(image, 2048);
  for (const quality of [0.9, 0.78, 0.65, 0.5]) {
    const blob = await canvasToWebp(canvas, quality);
    if (blob.size <= MAX_OUTPUT_BYTES)
      return new File([blob], outputName(name, "webp"), { type: "image/webp" });
  }
  throw new Error("La imagen convertida supera los 10 MB. Probá con una imagen más pequeña.");
}

async function rasterToSvg(image: ImageBitmap | HTMLImageElement, name: string, threshold: number): Promise<File> {
  const canvas = drawImage(image, 720);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No se pudo vectorizar la imagen.");
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  let darkPixels = 0;
  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3];
    const brightness = 0.2126 * imageData.data[index] + 0.7152 * imageData.data[index + 1] + 0.0722 * imageData.data[index + 2];
    const dark = alpha > 48 && brightness < threshold;
    imageData.data[index] = dark ? 0 : 255;
    imageData.data[index + 1] = dark ? 0 : 255;
    imageData.data[index + 2] = dark ? 0 : 255;
    imageData.data[index + 3] = dark ? 255 : 0;
    if (dark) darkPixels += 1;
  }
  if (darkPixels === 0) throw new Error("No se detectaron trazos oscuros para generar el SVG. Ajustá el contraste.");
  const { default: ImageTracer } = await import("imagetracerjs");
  const traced = ImageTracer.imagedataToSVG(imageData, {
    pal: [{ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 0 }],
    colorsampling: 0,
    colorquantcycles: 1,
    pathomit: 4,
    ltres: 1,
    qtres: 1,
    strokewidth: 0,
    viewbox: true,
  });
  const safe = sanitizeSvg(traced);
  const result = new File([safe], outputName(name, "svg"), { type: "image/svg+xml" });
  if (result.size > MAX_OUTPUT_BYTES)
    throw new Error("El trazado SVG supera los 10 MB. Probá con WebP o una imagen más simple.");
  return result;
}

export async function preparePersonalizerIcon(file: File, format: IconOutputFormat = "webp", threshold = 150): Promise<{ file: File; extension: IconOutputFormat }> {
  if (!file.size) throw new Error("El archivo está vacío.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("La imagen original no puede superar los 20 MB.");
  if (format !== "svg" && format !== "webp") throw new Error("Elegí SVG o WebP.");

  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  const cleanedSvg = isSvg ? new File([sanitizeSvg(await file.text())], outputName(file.name, "svg"), { type: "image/svg+xml" }) : null;
  if (cleanedSvg && format === "svg") {
    if (cleanedSvg.size > MAX_OUTPUT_BYTES) throw new Error("El SVG supera los 10 MB.");
    return { file: cleanedSvg, extension: "svg" };
  }

  const image = await decodeImage(cleanedSvg ?? file);
  try {
    const prepared = format === "webp"
      ? await rasterToWebp(image, file.name)
      : await rasterToSvg(image, file.name, threshold);
    return { file: prepared, extension: format };
  } finally {
    if (image instanceof ImageBitmap) image.close();
  }
}
