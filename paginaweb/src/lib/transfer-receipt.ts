export function validateReceipt(mime: string, bytes: Uint8Array): string {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("El comprobante debe tener entre 1 byte y 5 MB.");
  const text = new TextDecoder().decode(bytes.slice(0, 12));
  if (mime === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (mime === "image/png" && bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return "png";
  if (mime === "image/webp" && text.startsWith("RIFF") && text.slice(8) === "WEBP") return "webp";
  if (mime === "application/pdf" && text.startsWith("%PDF-")) return "pdf";
  throw new Error("El comprobante debe ser un archivo JPG, PNG, WebP o PDF válido.");
}
