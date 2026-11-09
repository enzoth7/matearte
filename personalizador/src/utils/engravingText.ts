export function normalizeEngravingText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^ /, "")
    .toLocaleUpperCase("es-UY");
}

export function limitEngravingCharacters(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join("");
}
