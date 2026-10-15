"use server";

import {
  parseRuralRaffleEntry,
  RURAL_CAMPAIGN,
  type RuralRaffleState,
} from "@/lib/rural-raffle";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function enterRuralRaffle(
  _previousState: RuralRaffleState,
  formData: FormData,
): Promise<RuralRaffleState> {
  // Honeypot: bots usually fill this visually hidden field.
  if (String(formData.get("website") || "").trim()) return { status: "success" };

  const parsed = parseRuralRaffleEntry(formData);
  if (!parsed.ok) return { status: parsed.reason };

  const now = new Date().toISOString();
  const { fullName, email, phone, city, country, birthDate, productInterest, marketingOptIn } = parsed.value;

  try {
    const supabase = createAdminSupabase();
    const { error } = await supabase.from("rural_raffle_entries").upsert({
      campaign: RURAL_CAMPAIGN,
      full_name: fullName,
      email,
      phone,
      city,
      country,
      birth_date: birthDate,
      product_interest: productInterest,
      privacy_consent_at: now,
      marketing_opt_in: marketingOptIn,
      marketing_opt_in_at: marketingOptIn ? now : null,
      source: "qr-rural",
    }, { onConflict: "campaign,email" });

    if (error) throw error;
    return { status: "success" };
  } catch (error) {
    console.error("No se pudo registrar la participación de La Rural.", error);
    return { status: "error" };
  }
}
