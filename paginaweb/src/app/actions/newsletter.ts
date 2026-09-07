"use server";

import { subscribeNewsletterContact, type NewsletterState } from "@/lib/newsletter";
import { createAdminSupabase } from "@/lib/supabase/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanSecret(value?: string) {
  return value?.replace(/^["']|["']$/g, "").trim();
}

export async function subscribeToNewsletter(
  _previousState: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const email = String(formData.get("email") || "").trim().toLowerCase().slice(0, 320);
  const name = String(formData.get("nombre") || "").trim().slice(0, 100);
  const website = String(formData.get("website") || "").trim();

  // Bots suelen completar este campo invisible. Respondemos como si hubiera salido bien.
  if (website) return { status: "success" };
  if (!emailPattern.test(email)) return { status: "invalid" };

  const apiKey = cleanSecret(process.env.RESEND_API_KEY);
  const topicId = cleanSecret(process.env.RESEND_NEWSLETTER_TOPIC_ID);
  if (!apiKey || !topicId) {
    console.error("Newsletter no configurado: faltan secretos de Resend.");
    return { status: "error" };
  }

  try {
    const result = await subscribeNewsletterContact(email, name, { apiKey, topicId });

    try {
      const supabase = createAdminSupabase();
      await supabase.from("newsletter_subscribers").upsert({
        email,
        first_name: name || null,
        status: "active",
        source: "footer",
        resend_contact_id: result?.contactId || null,
        subscribed_at: new Date().toISOString(),
        unsubscribed_at: null,
      }, { onConflict: "email" });
    } catch (dbError) {
      console.error("No se pudo persistir el suscriptor en Supabase.", dbError);
    }

    return { status: "success" };
  } catch (error) {
    console.error("No se pudo registrar la suscripción en Resend.", error);
    return { status: "error" };
  }
}
