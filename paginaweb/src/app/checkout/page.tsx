import type { Metadata } from "next";
import { CheckoutForm } from "@/components/CheckoutForm";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const { user, client } = await requireUser();
  const { data: profile } = user
    ? await client.from("customer_profiles").select("full_name,phone,department,city,address_line1,postal_code").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const address = [profile?.address_line1, profile?.city, profile?.postal_code].filter(Boolean).join(", ");
  const initialCustomer = {
    fullName: profile?.full_name || (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : ""),
    phone: profile?.phone || "",
    department: profile?.department || "",
    address,
  };
  return <main id="contenido" className="section-space"><div className="container-shell"><p className="eyebrow text-[var(--leather)]">Compra</p><h1 className="display-xl mt-7">Finalizar compra</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-black/60">Tu pedido se considera pagado únicamente cuando Mercado Pago lo confirma por webhook.</p><div className="mt-12"><CheckoutForm initialCustomer={initialCustomer} /></div></div></main>;
}
