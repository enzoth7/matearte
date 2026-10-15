import "server-only";

import worldCities from "cities.json";
import { countryName, countryOptionsForLocale } from "@/lib/countries";

const sorter = new Intl.Collator("es-UY", { sensitivity: "base" });
const cityNamesByCountry = new Map<string, Set<string>>();

for (const entry of worldCities) {
  if (!entry.country || !entry.name) continue;
  const names = cityNamesByCountry.get(entry.country) || new Set<string>();
  names.add(entry.name.trim());
  cityNamesByCountry.set(entry.country, names);
}

const citiesByCountry = new Map(
  [...cityNamesByCountry].map(([code, names]) => [code, [...names].sort(sorter.compare)]),
);

export const ruralCountryOptions = countryOptionsForLocale("es")
  .filter(({ code }) => citiesByCountry.has(code));

export function ruralCityOptions(countryCode: string, query = "", limit = 200) {
  const all = citiesByCountry.get(countryCode.toUpperCase()) || [];
  const normalizedQuery = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const matching = normalizedQuery
    ? all.filter((city) => city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").includes(normalizedQuery))
    : all;
  return { cities: matching.slice(0, limit), truncated: matching.length > limit };
}

export function resolveRuralLocation(countryCode: string, city: string) {
  const code = countryCode.toUpperCase();
  if (!ruralCountryOptions.some((country) => country.code === code)) return null;
  const selectedCity = (citiesByCountry.get(code) || []).find((option) => option === city);
  if (!selectedCity) return null;
  return { country: countryName(code, "es"), city: selectedCity };
}
