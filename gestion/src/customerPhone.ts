// Solo códigos de país: el 9 que sigue a +54 en un móvil argentino
// pertenece al número internacional, no al prefijo de Argentina.
const dialingCodes = [
  "996", "974", "972", "971", "966", "880", "598", "595", "593", "591",
  "507", "506", "504", "503", "502", "351",
  "92", "91", "90", "86", "82", "81", "65", "64", "63", "62", "61", "60",
  "58", "57", "56", "55", "54", "53", "52", "51", "49", "47", "46", "44",
  "41", "39", "34", "33", "32", "31", "27", "7", "1",
];

const countryCodes: Record<string, string> = {
  uruguay: "598", uy: "598", argentina: "54", ar: "54", brasil: "55", br: "55", chile: "56", cl: "56", paraguay: "595", py: "595",
  espana: "34", es: "34", "estados unidos": "1", us: "1", canada: "1", ca: "1", "puerto rico": "1", pr: "1",
  mexico: "52", mx: "52", colombia: "57", co: "57", peru: "51", pe: "51", bolivia: "591", bo: "591",
  venezuela: "58", ve: "58", ecuador: "593", ec: "593", italia: "39", it: "39", francia: "33", fr: "33", alemania: "49", de: "49", rusia: "7", ru: "7",
  cn: "86", au: "61", hn: "504", pt: "351", gb: "44", gt: "502", ae: "971", pa: "507", cr: "506", ch: "41", sa: "966",
  be: "32", il: "972", in: "91", nl: "31", se: "46", za: "27", my: "60", kr: "82", no: "47", sg: "65", tr: "90",
  cu: "53", sv: "503", pk: "92", ph: "63", id: "62", kg: "996", bd: "880", qa: "974", nz: "64",
};

export function customerPhonePrefix(country: string): string {
  const key = country.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return countryCodes[key] ? `+${countryCodes[key]}` : "";
}

export function splitCustomerPhone(phone: string, country?: string): { prefix: string; number: string } {
  const trimmed = phone.trim();
  if (!trimmed) return { prefix: "", number: "" };
  const digits = trimmed.replace(/\D/g, "");
  const countryKey = (country || "").trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const countryCode = countryCodes[countryKey];
  if (trimmed.startsWith("+")) {
    const code = dialingCodes.find((candidate) => digits.startsWith(candidate) && digits.length > candidate.length);
    if (!code) return { prefix: "", number: trimmed };
    const national = digits.slice(code.length);
    return { prefix: `+${code}`, number: code === "598" && national.startsWith("9") ? `0${national}` : national };
  }
  const national = countryCode === "598" && digits.startsWith("9") ? `0${digits}` : digits;
  return {
    prefix: countryCode ? `+${countryCode}` : "",
    number: national || trimmed,
  };
}

export function joinCustomerPhone(prefix: string, number: string): string {
  const cleanNumber = number.trim();
  if (!cleanNumber) return "";
  const code = prefix.replace(/\D/g, "");
  if (!code) return cleanNumber;
  const digits = cleanNumber.replace(/\D/g, "");
  return digits ? `+${code}${code === "598" ? digits.replace(/^0/, "") : digits}` : "";
}
