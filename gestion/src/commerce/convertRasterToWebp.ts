export async function convertRasterToWebp(file: File, quality: number, maxBytes: number): Promise<File> {
  if (file.type === "image/webp") return file;
  if (file.type !== "image/png" && file.type !== "image/jpeg")
    throw new Error("El archivo debe ser PNG, JPG o WebP.");

  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen.");
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob || blob.type !== "image/webp")
      throw new Error("Este navegador no pudo convertir la imagen a WebP.");
    if (blob.size > maxBytes)
      throw new Error(`La imagen WebP supera el límite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
