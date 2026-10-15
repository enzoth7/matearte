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
  const email = String(formData.get("email") || "").trim().toLowerCase().slice(0, 320);
  const phone = normalizeUruguayPhone(String(formData.get("phone") || ""));
  const productInterest = String(formData.get("productInterest") || "");
  const privacyConsent = formData.get("privacyConsent") === "on";
  const marketingOptIn = formData.get("marketingOptIn") === "on";

  if (!privacyConsent) return { ok: false as const, reason: "consent-required" as const };
  if (
    !emailPattern.test(email)
    || !phone
    || !ruralProductInterests.includes(productInterest as RuralProductInterest)
  ) {
    return { ok: false as const, reason: "invalid" as const };
  }

  return {
    ok: true as const,
    value: {
      email,
      phone,
      productInterest: productInterest as RuralProductInterest,
      marketingOptIn,
    },
  };
}
