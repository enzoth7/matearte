import { countries as countryMetadata, type TCountryCode } from "countries-list";
import { countries } from "country-flag-icons";
import { allCountries } from "country-region-data";
import type { Locale } from "@/types/catalog";

const languageTags: Record<Locale, string> = { es: "es-UY", en: "en", pt: "pt-BR" };
const displayNames = (locale: Locale) => new Intl.DisplayNames([languageTags[locale]], { type: "region" });
const collator = (locale: Locale) => new Intl.Collator(languageTags[locale], { sensitivity: "base" });

export type CountryRegion = {
  code: string;
  name: string;
};

const regionsByCountry = new Map<string, CountryRegion[]>(
  allCountries.map(([, countryCode, regions]) => [
    countryCode,
    regions
      .map(([name, code]) => ({ code, name }))
      .sort((left, right) => collator("es").compare(left.name, right.name)),
  ]),
);

export function countryOptionsForLocale(locale: Locale = "es") {
  const names = displayNames(locale);
  const sorter = collator(locale);
  return countries
    .filter((code) => /^[A-Z]{2}$/.test(code))
    .map((code) => ({ code, name: names.of(code) || code }))
    .filter(({ code, name }) => name !== code)
    .sort((left, right) => sorter.compare(left.name, right.name));
}

export const countryOptions = countryOptionsForLocale("es");

export function countryName(code?: string | null, locale: Locale = "es") {
  if (!code) return "";
  return displayNames(locale).of(code.toUpperCase()) || code.toUpperCase();
}

export function countryRegions(code?: string | null) {
  if (!code) return [];
  return regionsByCountry.get(code.toUpperCase()) || [];
}

export function countryCallingCode(code?: string | null) {
  if (!code) return "";
  const country = countryMetadata[code.toUpperCase() as TCountryCode];
  const callingCode = country?.phone?.[0];
  return callingCode ? `+${callingCode}` : "";
}

export function localPhoneNumber(phone: string, countryCode: string) {
  const value = phone.trim();
  const callingCode = countryCallingCode(countryCode);
  if (!callingCode || !value.startsWith(callingCode)) return value;
  return value.slice(callingCode.length).trimStart();
}

export function internationalPhoneNumber(countryCode: string, localNumber: string) {
  const value = localNumber.trim();
  if (!value) return "";
  const callingCode = countryCallingCode(countryCode);
  if (!callingCode) return value;
  const withoutRepeatedPrefix = value.startsWith(callingCode)
    ? value.slice(callingCode.length).trimStart()
    : value;
  return `${callingCode} ${withoutRepeatedPrefix}`.trim();
}
