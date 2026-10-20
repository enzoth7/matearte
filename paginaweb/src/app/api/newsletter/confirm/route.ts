import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/config";
import { subscribeNewsletterContact } from "@/lib/newsletter";
import { localizeCanonicalPath } from "@/i18n/paths";
import { isLocale } from "@/i18n/config";

const secret = (value?: string) => value?.replace(/^["']|["']$/g, "").trim() || "";

export async function GET(request: NextRequest) {
  const localeValue = request.cookies.get("NEXT_LOCALE")?.value;
  const locale = isLocale(localeValue) ? localeValue : "es";
  const profileUrl = new URL(localizeCanonicalPath("/perfil", locale), siteUrl());
  const token = new URL(request.url).searchParams.get("token_hash") || "";
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(token)) {
    profileUrl.searchParams.set("suscripcion", "invalida");
    return NextResponse.redirect(profileUrl, 303);
  }
  const client = await createServerSupabase();
  const { data, error } = await client.auth.verifyOtp({ type: "magiclink", token_hash: token });
  const email = data.user?.email?.trim().toLowerCase();
  if (error || !email) {
    profileUrl.searchParams.set("suscripcion", "invalida");
    return NextResponse.redirect(profileUrl, 303);
  }
  const admin = createAdminSupabase();
  const { data: subscription } = await admin.from("newsletter_subscribers")
    .select("first_name,status").eq("email", email).maybeSingle();
  if (subscription?.status === "pending") {
    const { error: saveError } = await admin.from("newsletter_subscribers").update({
      status: "active", confirmed_at: new Date().toISOString(), marketing_synced_at: null, unsubscribed_at: null,
    }).eq("email", email).eq("status", "pending");
    if (!saveError) {
      const apiKey = secret(process.env.RESEND_API_KEY);
      const topicId = secret(process.env.RESEND_NEWSLETTER_TOPIC_ID);
      if (apiKey && topicId) {
        try {
          const result = await subscribeNewsletterContact(email, subscription.first_name || "", {
            apiKey, topicId, segmentId: secret(process.env.RESEND_MARKETING_SEGMENT_ID),
          });
          await admin.from("newsletter_subscribers").update({ resend_contact_id: result.contactId || null, marketing_synced_at: process.env.RESEND_MARKETING_SEGMENT_ID ? new Date().toISOString() : null }).eq("email", email);
        } catch (syncError) { console.error("No se pudo sincronizar la suscripción confirmada.", syncError); }
      }
      profileUrl.searchParams.set("suscripcion", "confirmada");
    }
  }
  const response = NextResponse.redirect(profileUrl, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const dynamic = "force-dynamic";
