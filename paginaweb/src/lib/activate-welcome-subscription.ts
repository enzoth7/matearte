import "server-only";

import type { User } from "@supabase/supabase-js";
import { subscribeNewsletterContact } from "@/lib/newsletter";
import { createAdminSupabase } from "@/lib/supabase/server";

const secret = (value?: string) => value?.replace(/^["']|["']$/g, "").trim() || "";

/** A verified store login can finish a welcome signup made with the same email. */
export async function activateWelcomeSubscriptionForVerifiedUser(user: User) {
  if (!user.email || !user.email_confirmed_at) return false;

  const admin = createAdminSupabase();
  const email = user.email.trim().toLowerCase();
  const { data: subscription, error: lookupError } = await admin.from("newsletter_subscribers")
    .select("first_name,source")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (lookupError) {
    console.error("No se pudo consultar la suscripción pendiente.", lookupError);
    return false;
  }
  if (!subscription?.source?.startsWith("welcome")) return false;

  const { data: activated, error: updateError } = await admin.from("newsletter_subscribers")
    .update({ status: "active", confirmed_at: new Date().toISOString(), marketing_synced_at: null, unsubscribed_at: null })
    .eq("email", email)
    .eq("status", "pending")
    .select("first_name")
    .maybeSingle();
  if (updateError) {
    console.error("No se pudo activar la suscripción de bienvenida.", updateError);
    return false;
  }
  if (!activated) return false;

  const apiKey = secret(process.env.RESEND_API_KEY);
  const topicId = secret(process.env.RESEND_NEWSLETTER_TOPIC_ID);
  if (apiKey && topicId) {
    try {
      const segmentId = secret(process.env.RESEND_MARKETING_SEGMENT_ID);
      const result = await subscribeNewsletterContact(email, activated.first_name || "", { apiKey, topicId, segmentId });
      await admin.from("newsletter_subscribers").update({
        resend_contact_id: result.contactId || null,
        marketing_synced_at: segmentId ? new Date().toISOString() : null,
      }).eq("email", email).eq("status", "active");
    } catch (error) {
      // The confirmed coupon remains available; marketing can retry the pending sync.
      console.error("No se pudo sincronizar la suscripción confirmada.", error);
    }
  }

  return true;
}
