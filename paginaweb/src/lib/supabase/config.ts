const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
};

export const supabaseUrl = () => required("NEXT_PUBLIC_SUPABASE_URL");
export const supabasePublishableKey = () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
export const supabaseServiceRoleKey = () => required("SUPABASE_SERVICE_ROLE_KEY");

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").trim().replace(/\/$/, "");
export const customizerUrl = () => (process.env.NEXT_PUBLIC_CUSTOMIZER_URL || "http://localhost:5173").trim().replace(/\/$/, "");
export const commerceAdminUrl = () => (process.env.COMMERCE_ADMIN_URL || "http://localhost:5174").trim().replace(/\/$/, "");
export const whatsappNumber = () => (process.env.MATEARTE_WHATSAPP_NUMBER || "+59891674231").replace(/\D/g, "");

export function isAllowedCustomizerOrigin(origin: string | null) {
  if (!origin) return false;
  return origin === new URL(customizerUrl()).origin || /^http:\/\/localhost:\d+$/.test(origin);
}

export function isAllowedCommerceAdminOrigin(origin: string | null) {
  if (!origin) return false;
  return origin === new URL(commerceAdminUrl()).origin || /^http:\/\/localhost:\d+$/.test(origin);
}
