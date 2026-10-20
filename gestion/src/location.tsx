import { useState } from "react";
import flagCountries from "flag-icons/country.json";
import "flag-icons/css/flag-icons.min.css";

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const displayNames = new Intl.DisplayNames(["es"], { type: "region" });
const countries = flagCountries
  .filter((country) => country.iso)
  .map((country) => ({
    code: country.code,
    name: displayNames.of(country.code.toUpperCase()) || country.name,
    englishName: country.name,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

const codes = new Map<string, string>();
countries.forEach((country) => {
  codes.set(country.code, country.code);
  codes.set(normalize(country.name), country.code);
  codes.set(normalize(country.englishName), country.code);
});
const namesByCode = new Map(countries.map((country) => [country.code, country.name]));

export function countryDisplayName(value: string) {
  const trimmed = value.trim();
  return /^[a-z]{2}$/i.test(trimmed) ? namesByCode.get(trimmed.toLowerCase()) || trimmed : trimmed;
}

const cityCountries: Record<string, string> = {
  montevideo: "Uruguay",
  maldonado: "Uruguay",
  colonia: "Uruguay",
  "colonia del sacramento": "Uruguay",
  rocha: "Uruguay",
  "buenos aires": "Argentina",
  madrid: "España",
};

export const countryOptions = ["Sin especificar", "Uruguay", ...countries
  .map((country) => country.name)
  .filter((name) => normalize(name) !== "uruguay")];

export function countryForCity(city: string) {
  return cityCountries[normalize(city)] || "Sin especificar";
}

export function flagCode(place: string, country?: string) {
  const source = country && country !== "Sin especificar" ? country : place;
  return source.split(/[,·]/).map(normalize).map((part) =>
    codes.get(part) || codes.get(normalize(cityCountries[part] || "")),
  ).find(Boolean);
}

export function CountryFlag({ place, country }: { place: string; country?: string }) {
  const code = flagCode(place, country);
  return code ? <i className={`fi fi-${code} place-flag`} aria-hidden="true" /> : null;
}

export function LocationLabel({ place, country }: { place: string; country?: string }) {
  return <div className="location-label"><CountryFlag place={place} country={country} />{countryDisplayName(place)}</div>;
}

export function CountrySelect({ name, initial }: { name: string; initial: string }) {
  const [country, setCountry] = useState(() => countryDisplayName(initial));
  return (
    <div className="country-select">
      <CountryFlag place={country} />
      <select name={name} value={country} onChange={(event) => setCountry(event.target.value)}>
        {countryOptions.map((option) => <option key={option}>{option}</option>)}
      </select>
    </div>
  );
}
