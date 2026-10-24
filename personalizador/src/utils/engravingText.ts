export function normalizeEngravingText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^ /, "")
    .toLocaleUpperCase("es-UY");
}
