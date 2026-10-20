"use server";

import { subscribeNewsletterContact, type NewsletterState } from "@/lib/newsletter";
import { createAdminSupabase } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/config";
import { newsletterConfirmationEmail } from "@/lib/newsletter-confirmation-email";

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
  const source = formData.get("source") === "welcome" ? "welcome" : "footer";
  const utmSource = String(formData.get("utm_source") || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 42);

  // Bots suelen completar este campo invisible. Respondemos como si hubiera salido bien.
  if (website) return { status: "success" };
  if (!emailPattern.test(email)) return { status: "invalid" };
  if (source === "welcome" && !name) return { status: "invalid_name" };

  const apiKey = cleanSecret(process.env.RESEND_API_KEY);
  const topicId = cleanSecret(process.env.RESEND_NEWSLETTER_TOPIC_ID);
  if (!apiKey || !topicId) {
    console.error("Newsletter no configurado: faltan secretos de Resend.");
    return { status: "error" };
  }

  try {
    if (source === "welcome") {
      const supabase = createAdminSupabase();
      const { data: settings, error: settingsError } = await supabase.from("marketing_subscription_settings")
        .select("enabled,discount_code").eq("id", true).single();
      if (settingsError || !settings?.enabled) return { status: "error" };
      const { data: discount } = await supabase.from("commerce_discounts")
        .select("enabled,welcome_only,valid_from,valid_until").eq("code", settings.discount_code).maybeSingle();
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      if (!discount?.enabled || !discount.welcome_only || discount.valid_from > today || discount.valid_until < today) return { status: "error" };
      const { data: previous } = await supabase.from("newsletter_subscribers")
        .select("status,source,origin_channel,confirmed_at,welcome_discount_sent_at").eq("email", email).maybeSingle();
      if (previous?.status === "pending" && previous.welcome_discount_sent_at && Date.now() - new Date(previous.welcome_discount_sent_at).getTime() < 60_000) return { status: "success" };
      const { data: link, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
      if (linkError || !link?.properties?.hashed_token || !link.user) throw linkError || new Error("No se pudo generar el enlace.");
      const { data: staff } = await supabase.from("commerce_admin_users").select("user_id").eq("user_id", link.user.id).eq("active", true).maybeSingle();
      if (staff) return { status: "success" };
      const from = cleanSecret(process.env.MARKETING_EMAIL_FROM || process.env.NEWSLETTER_EMAIL_FROM || process.env.COMMERCE_EMAIL_FROM);
      if (!from) throw new Error("Falta configurar el remitente.");
      const confirmUrl = `${siteUrl()}/api/newsletter/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}`;
      const alreadyConfirmed = previous?.status === "active" && Boolean(previous.confirmed_at);
      const { error: saveError } = await supabase.from("newsletter_subscribers").upsert({
        email, first_name: name || null, status: alreadyConfirmed ? "active" : "pending",
        source: previous?.status === "active" ? previous.source : (utmSource ? `welcome:${utmSource}` : "welcome"),
        origin_channel: previous?.status === "active" ? previous.origin_channel : "Suscripción con desc.",
        subscribed_at: new Date().toISOString(), confirmed_at: alreadyConfirmed ? previous.confirmed_at : null,
        welcome_discount_sent_at: null, marketing_synced_at: null, unsubscribed_at: null,
      }, { onConflict: "email" });
      if (saveError) throw saveError;
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email], ...newsletterConfirmationEmail(confirmUrl, siteUrl()) }),
        cache: "no-store",
      });
      if (!sent.ok) throw new Error(`No se pudo enviar la confirmación (${sent.status}).`);
      await supabase.from("newsletter_subscribers").update({ welcome_discount_sent_at: new Date().toISOString() }).eq("email", email);
      return { status: "success" };
    }
    const segmentId = cleanSecret(process.env.RESEND_MARKETING_SEGMENT_ID);
    const result = await subscribeNewsletterContact(email, name, { apiKey, topicId, segmentId });

    const supabase = createAdminSupabase();
    const { data: previous } = await supabase.from("newsletter_subscribers")
      .select("source,origin_channel,confirmed_at,status").eq("email", email).maybeSingle();
    const { error: saveError } = await supabase.from("newsletter_subscribers").upsert({
      email,
      first_name: name || null,
      status: "active",
      source: previous?.status === "active" ? previous.source : "footer",
      origin_channel: previous?.status === "active" ? previous.origin_channel : "Suscripción",
      confirmed_at: previous?.status === "active" ? previous.confirmed_at : null,
      resend_contact_id: result?.contactId || null,
      marketing_synced_at: segmentId ? new Date().toISOString() : null,
      subscribed_at: new Date().toISOString(),
      unsubscribed_at: null,
    }, { onConflict: "email" });
    if (saveError) throw saveError;

    return { status: "success" };
  } catch (error) {
    console.error("No se pudo registrar la suscripción en Resend.", error);
    return { status: "error" };
  }
}
