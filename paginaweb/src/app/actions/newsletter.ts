"use server";

import { subscribeNewsletterContact } from "@/lib/newsletter";

export type NewsletterState = {
  status: "idle" | "success" | "invalid" | "error";
};

export const initialNewsletterState: NewsletterState = { status: "idle" };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const topicId = process.env.RESEND_NEWSLETTER_TOPIC_ID?.trim();
  if (!apiKey || !topicId) {
    console.error("Newsletter no configurado: faltan secretos de Resend.");
    return { status: "error" };
  }

  try {
    await subscribeNewsletterContact(email, name, { apiKey, topicId });
    return { status: "success" };
  } catch (error) {
    console.error("No se pudo registrar la suscripción en Resend.", error);
    return { status: "error" };
  }
}
