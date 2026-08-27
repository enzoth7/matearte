import { countries } from "country-flag-icons";

const displayNames = new Intl.DisplayNames(["es-UY", "es"], { type: "region" });
const collator = new Intl.Collator("es-UY", { sensitivity: "base" });

export const countryOptions = countries
  .filter((code) => /^[A-Z]{2}$/.test(code))
  .map((code) => ({ code, name: displayNames.of(code) || code }))
  .filter(({ code, name }) => name !== code)
  .sort((left, right) => collator.compare(left.name, right.name));

export function countryName(code?: string | null) {
  if (!code) return "";
  return displayNames.of(code.toUpperCase()) || code.toUpperCase();
}
