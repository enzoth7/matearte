export const RURAL_CAMPAIGN = "rural-2026";

export const ruralProductInterests = [
  "mates",
  "bombillas",
  "materas",
  "termos",
  "personalizados",
  "botas",
  "carteras",
  "otros-articulos-cuero",
] as const;

export type RuralProductInterest = (typeof ruralProductInterests)[number];

export type RuralRaffleState = {
  status: "idle" | "success" | "invalid" | "consent-required" | "error";
};

export const initialRuralRaffleState: RuralRaffleState = { status: "idle" };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUruguayPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("0")) return `+598${digits.slice(1)}`;
  if (digits.length === 8) return `+598${digits}`;
  if (digits.startsWith("598") && digits.length === 11) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function parseRuralRaffleEntry(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") || "").trim().toLowerCase().slice(0, 320);
  const phone = normalizeUruguayPhone(String(formData.get("phone") || ""));
  const city = String(formData.get("city") || "").trim().replace(/\s+/g, " ");
  const countryCode = String(formData.get("countryCode") || "").trim().toUpperCase();
  const birthDate = String(formData.get("birthDate") || "");
  const parsedBirthDate = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? new Date(`${birthDate}T00:00:00Z`) : null;
  const validBirthDate = parsedBirthDate
    && !Number.isNaN(parsedBirthDate.getTime())
    && parsedBirthDate.toISOString().slice(0, 10) === birthDate
    && birthDate >= "1900-01-01"
    && birthDate <= new Date().toISOString().slice(0, 10);
  const productInterest = String(formData.get("productInterest") || "");
  const privacyConsent = formData.get("privacyConsent") === "on";
  const marketingOptIn = formData.get("marketingOptIn") === "on";

  if (!privacyConsent) return { ok: false as const, reason: "consent-required" as const };
  if (
    fullName.length < 2 || fullName.length > 120
    || city.length < 1 || city.length > 120
    || !/^[A-Z]{2}$/.test(countryCode)
    || !validBirthDate
    || !emailPattern.test(email)
    || !phone
    || !ruralProductInterests.includes(productInterest as RuralProductInterest)
  ) {
    return { ok: false as const, reason: "invalid" as const };
  }

  return {
    ok: true as const,
    value: {
      fullName,
      email,
      phone,
      city,
      countryCode,
      birthDate,
      productInterest: productInterest as RuralProductInterest,
      marketingOptIn,
    },
  };
}
