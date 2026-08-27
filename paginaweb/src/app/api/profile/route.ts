import { countries } from "country-flag-icons";
import { apiError, apiOk } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";

const allowedCountries = new Set(countries.filter((code) => /^[A-Z]{2}$/.test(code)));
const allowedAvatarTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const text = (data: FormData, name: string, max: number) =>
  String(data.get(name) || "").trim().slice(0, max);

export async function POST(request: Request) {
  const { user, client } = await requireUser();
  if (!user) return apiError("Necesitás iniciar sesión.", 401);

  try {
    const data = await request.formData();
    const fullName = text(data, "fullName", 120);
    const phone = text(data, "phone", 40);
    const company = text(data, "company", 120);
    const birthDate = text(data, "birthDate", 10);
    const countryCode = text(data, "countryCode", 2).toUpperCase();
    const department = text(data, "department", 80);
    const city = text(data, "city", 120);
    const addressLine1 = text(data, "addressLine1", 180);
    const postalCode = text(data, "postalCode", 20);

    if (!fullName || !birthDate || !countryCode || !city || !addressLine1) {
      return apiError("Completá nombre, cumpleaños, país, ciudad y dirección.");
    }
    if (!allowedCountries.has(countryCode)) return apiError("Elegí un país válido.");
    if (countryCode === "UY" && !department) return apiError("Elegí tu departamento.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return apiError("La fecha de cumpleaños no es válida.");
    const birth = new Date(`${birthDate}T00:00:00Z`);
    if (Number.isNaN(birth.getTime()) || birth < new Date("1900-01-01T00:00:00Z") || birth > new Date()) {
      return apiError("La fecha de cumpleaños no es válida.");
    }

    const { data: existing } = await client
      .from("customer_profiles")
      .select("avatar_path")
      .eq("user_id", user.id)
      .maybeSingle();

    let avatarPath = existing?.avatar_path || null;
    const avatar = data.get("avatar");
    if (avatar instanceof File && avatar.size > 0) {
      if (!allowedAvatarTypes.has(avatar.type)) return apiError("La foto debe ser PNG, JPEG o WebP.");
      if (avatar.size > 2 * 1024 * 1024) return apiError("La foto no puede superar los 2 MB.");
      const extension = avatar.type === "image/png" ? "png" : avatar.type === "image/webp" ? "webp" : "jpg";
      const nextAvatarPath = `${user.id}/avatar.${extension}`;
      const bytes = await avatar.arrayBuffer();
      const uploaded = await client.storage.from("profile-avatars").upload(nextAvatarPath, bytes, {
        contentType: avatar.type,
        cacheControl: "3600",
        upsert: true,
      });
      if (uploaded.error) return apiError("No pudimos subir la foto de perfil.", 400, uploaded.error.message);
      avatarPath = nextAvatarPath;
    }

    const { error } = await client.from("customer_profiles").upsert({
      user_id: user.id,
      full_name: fullName,
      phone: phone || null,
      company: company || null,
      birth_date: birthDate,
      country_code: countryCode,
      department: department || null,
      city,
      address_line1: addressLine1,
      postal_code: postalCode || null,
      avatar_path: avatarPath,
      profile_completed_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) return apiError("No pudimos guardar tus datos.", 400, error.message);

    if (existing?.avatar_path && avatarPath && existing.avatar_path !== avatarPath) {
      await client.storage.from("profile-avatars").remove([existing.avatar_path]);
    }

    return apiOk({ saved: true });
  } catch (reason) {
    return apiError(reason instanceof Error ? reason.message : "No pudimos guardar tus datos.");
  }
}

export const dynamic = "force-dynamic";
