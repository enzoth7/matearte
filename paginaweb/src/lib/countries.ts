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

export function countryPhoneOptionsForLocale(locale: Locale = "es") {
  const names = displayNames(locale);
  const sorter = collator(locale);
  return countries
    .filter((code) => /^[A-Z]{2}$/.test(code))
    .map((code) => {
      const callingCode = countryCallingCode(code);
      return {
        code,
        callingCode,
        name: names.of(code) || code,
      };
    })
    .filter(({ name, callingCode }) => callingCode && name)
    .sort((a, b) => sorter.compare(a.name, b.name));
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

export type ParsedPhoneNumber = {
  phoneCountryCode: string;
  callingCode: string;
  localNumber: string;
};

export function parsePhoneNumber(
  phone: string,
  fallbackCountryCode: string = "UY",
): ParsedPhoneNumber {
  const fallbackUpper = fallbackCountryCode && /^[A-Z]{2}$/i.test(fallbackCountryCode)
    ? fallbackCountryCode.toUpperCase()
    : "UY";
  const fallbackCalling = countryCallingCode(fallbackUpper) || "+598";
  const trimmed = (phone || "").trim();

  if (!trimmed.startsWith("+")) {
    return {
      phoneCountryCode: fallbackUpper,
      callingCode: fallbackCalling,
      localNumber: trimmed,
    };
  }

  const afterPlus = trimmed.slice(1).trimStart();
  const validCountryCodes = countries.filter((code) => /^[A-Z]{2}$/.test(code));

  for (let len = 4; len >= 1; len--) {
    const candidateDigits = afterPlus.slice(0, len);
    if (candidateDigits.length !== len || !/^\d+$/.test(candidateDigits)) {
      continue;
    }
    const candidateCode = `+${candidateDigits}`;

    if (countryCallingCode(fallbackUpper) === candidateCode) {
      return {
        phoneCountryCode: fallbackUpper,
        callingCode: candidateCode,
        localNumber: afterPlus.slice(len).trimStart(),
      };
    }

    const matchedCountry = validCountryCodes.find(
      (code) => countryCallingCode(code) === candidateCode,
    );
    if (matchedCountry) {
      return {
        phoneCountryCode: matchedCountry,
        callingCode: candidateCode,
        localNumber: afterPlus.slice(len).trimStart(),
      };
    }
  }

  return {
    phoneCountryCode: fallbackUpper,
    callingCode: fallbackCalling,
    localNumber: afterPlus,
  };
}

