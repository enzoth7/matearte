import { allCountries } from "country-region-data";
import { flagCode } from "./location";

export function customerDepartments(country: string, current = ""): string[] {
  const countryCode = flagCode(country)?.toUpperCase();
  const regions = allCountries.find((entry) => entry[1] === countryCode)?.[2].map(([name]) => name) || [];
  return current && !regions.includes(current) ? [current, ...regions] : regions;
}
