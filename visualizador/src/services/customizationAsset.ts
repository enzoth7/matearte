import type { CustomImageAsset } from "../types/customizer";
import { uploadCustomizationAsset } from "./storageService";

export const MAX_CUSTOM_IMAGE_SIZE = 5 * 1024 * 1024;
export const ACCEPTED_CUSTOM_IMAGE_TYPES = ["image/png", "image/jpeg", "image/svg+xml"] as const;

export function validateCustomizationFile(file: File): string | null {
  const hasValidType = ACCEPTED_CUSTOM_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_CUSTOM_IMAGE_TYPES)[number]);
  const hasValidExtension = /\.(png|jpe?g|svg)$/i.test(file.name);
  if (!hasValidType && !hasValidExtension) {
    return "El archivo debe ser PNG, JPG o SVG.";
  }
  if (file.size > MAX_CUSTOM_IMAGE_SIZE) return "El archivo supera el máximo de 5 MB.";
  if (file.size === 0) return "El archivo está vacío.";
  return null;
}

export function sanitizeSvgMarkup(markup: string): string {
  const documentNode = new DOMParser().parseFromString(markup, "image/svg+xml");
  if (documentNode.querySelector("parsererror") || documentNode.documentElement.tagName.toLowerCase() !== "svg") {
    throw new Error("El SVG no tiene una estructura válida.");
  }

  documentNode.querySelectorAll("script, foreignObject, iframe, object, embed, audio, video").forEach((node) => node.remove());
  documentNode.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on")) node.removeAttribute(attribute.name);
      if ((name === "href" || name === "xlink:href") && !value.startsWith("#") && !value.startsWith("data:image/")) {
        node.removeAttribute(attribute.name);
      }
      if ((name === "style" || name === "fill" || name === "stroke") && /url\s*\(\s*["']?(?:https?:|\/\/)/i.test(value)) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return new XMLSerializer().serializeToString(documentNode.documentElement);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function rasterizeSvg(markup: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    const image = new Image();
    image.onload = () => {
      const maxDimension = 1200;
      const sourceWidth = Math.max(1, image.naturalWidth || 1000);
      const sourceHeight = Math.max(1, image.naturalHeight || 1000);
      const ratio = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
      canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("No se pudo generar la vista previa segura del SVG."));
    };
    image.src = blobUrl;
  });
}

export async function createCustomizationAsset(file: File): Promise<CustomImageAsset> {
  const validationError = validateCustomizationFile(file);
  if (validationError) throw new Error(validationError);

  const id = `upload-${crypto.randomUUID()}`;
  const originalDataUrl = await readFileAsDataUrl(file);
  let previewUrl = originalDataUrl;

  if (file.type === "image/svg+xml") {
    const safeMarkup = sanitizeSvgMarkup(await file.text());
    previewUrl = await rasterizeSvg(safeMarkup);
  }

  const uploadedUrl = await uploadCustomizationAsset(file, id);
  const resolvedMimeType = (file.type || (/\.png$/i.test(file.name) ? "image/png" : /\.svg$/i.test(file.name) ? "image/svg+xml" : "image/jpeg")) as CustomImageAsset["mimeType"];
  return {
    id,
    name: file.name,
    mimeType: resolvedMimeType,
    size: file.size,
    previewUrl,
    originalUrl: uploadedUrl ?? originalDataUrl,
    source: "upload",
  };
}

