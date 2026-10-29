import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArgentinaOrderPayment } from "@/components/ArgentinaOrderPayment";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { localizeCanonicalPath } from "@/i18n/paths";
import { requireUser } from "@/lib/supabase/server";
import type { Locale } from "@/types/catalog";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("bankTransferTitle"), robots: { index: false, follow: false } };
}

export default async function ArgentinaTransferPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale, t] = await Promise.all([params, getLocale() as Promise<Locale>, getTranslations("checkout")]);
  if (!uuid.test(id)) notFound();
  const { user, client } = await requireUser();
  if (!user) return <main id="contenido" className="bg-[var(--cream)] py-12"><div className="container-shell max-w-xl rounded-2xl bg-[var(--paper)] p-8"><h1 className="display-font text-4xl">{t("bankTransferTitle")}</h1><p className="my-5">{t("argentinaSignIn")}</p><GoogleAuthButton postLoginRedirect={`/transferencia/${id}`} /></div></main>;

  const { data: order, error } = await client.from("orders")
    .select("id,status,total_minor,currency,customer_snapshot,commerce_bank_transfer_receipts(status,rejection_reason)")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!order) notFound();
  if (order.currency !== "ARS" || order.customer_snapshot?.purchaseFlow !== "argentina_retail_transfer") {
    redirect(localizeCanonicalPath(`/pedidos/${id}`, locale));
  }

  const receipts = Array.isArray(order.commerce_bank_transfer_receipts)
    ? order.commerce_bank_transfer_receipts
    : order.commerce_bank_transfer_receipts ? [order.commerce_bank_transfer_receipts] : [];
  const rejectionReason = receipts.find(receipt => receipt.status === "rejected")?.rejection_reason || "";

  return <main id="contenido" className="bg-[var(--cream)] py-8 sm:py-12 lg:py-16">
    <div className="container-shell max-w-[77rem]">
      <ArgentinaOrderPayment
        orderId={order.id}
        status={order.status}
        totalMinor={order.total_minor}
        bank={(order.customer_snapshot?.bank || {}) as Record<string, unknown>}
        rejectionReason={rejectionReason}
      />
    </div>
  </main>;
}

export const dynamic = "force-dynamic";
