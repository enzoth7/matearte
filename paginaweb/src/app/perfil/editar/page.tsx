import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileEditor } from "@/components/ProfileEditor";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Editar mi perfil", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const { user, client } = await requireUser();
  if (!user) redirect("/perfil");

  const { data: profile } = await client
    .from("customer_profiles")
    .select("full_name,phone,company,birth_date,country_code,department,city,address_line1,postal_code,profile_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const fallbackName = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : "";

  return (
    <main id="contenido" className="section-space">
      <div className="container-shell max-w-5xl">
        <ProfileEditor
          email={user.email || ""}
          welcome={!profile?.profile_completed_at}
          initial={{
            fullName: profile?.full_name || fallbackName,
            phone: profile?.phone || "",
            company: profile?.company || "",
            birthDate: profile?.birth_date || "",
            countryCode: profile?.country_code || "UY",
            department: profile?.department || "",
            city: profile?.city || "",
            addressLine1: profile?.address_line1 || "",
            postalCode: profile?.postal_code || "",
          }}
        />
      </div>
    </main>
  );
}
