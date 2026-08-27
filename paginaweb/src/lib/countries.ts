import { countries as countryMetadata, type TCountryCode } from "countries-list";
import { countries } from "country-flag-icons";
import { allCountries } from "country-region-data";

const displayNames = new Intl.DisplayNames(["es-UY", "es"], { type: "region" });
const collator = new Intl.Collator("es-UY", { sensitivity: "base" });

export type CountryRegion = {
  code: string;
  name: string;
};

const regionsByCountry = new Map<string, CountryRegion[]>(
  allCountries.map(([, countryCode, regions]) => [
    countryCode,
    regions
      .map(([name, code]) => ({ code, name }))
      .sort((left, right) => collator.compare(left.name, right.name)),
  ]),
);

export const countryOptions = countries
  .filter((code) => /^[A-Z]{2}$/.test(code))
  .map((code) => ({ code, name: displayNames.of(code) || code }))
  .filter(({ code, name }) => name !== code)
  .sort((left, right) => collator.compare(left.name, right.name));

export function countryName(code?: string | null) {
  if (!code) return "";
  return displayNames.of(code.toUpperCase()) || code.toUpperCase();
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
