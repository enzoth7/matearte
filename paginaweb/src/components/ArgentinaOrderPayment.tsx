"use client";

import { Bank, UploadSimple } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import type { Locale } from "@/types/catalog";

const receiptTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export function ArgentinaOrderPayment({ orderId, status, totalMinor, bank, rejectionReason }: { orderId: string; status: string; totalMinor: number; bank: Record<string, unknown>; rejectionReason: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("checkout");
  const [transferConfirmed, setTransferConfirmed] = useState(Boolean(rejectionReason));
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canUpload = status === "pending_payment" || status === "payment_failed";
  const bankEntries = ([
    ["alias", t("argentinaAlias")],
    ["cbu", "CBU"],
    ["bank_name", t("argentinaBank")],
    ["account_holder", t("accountHolder")],
  ] as const).filter(([key]) => key !== "account_holder" || Boolean(bank.account_holder));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!receipt) return;
    if (receipt.size > 5 * 1024 * 1024) { setError(t("receiptTooLarge")); return; }
    if (!receiptTypes.has(receipt.type)) { setError(t("receiptInvalidType")); return; }
    setBusy(true); setError("");
    try {
      const storageKey = `argentina_receipt_${orderId}`;
      const key = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
      const form = new FormData();
      form.set("receipt", receipt);
      const response = await fetch(`/api/orders/${orderId}/receipt`, { method: "POST", headers: { "idempotency-key": key }, body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t("argentinaUploadFailed"));
      sessionStorage.removeItem(storageKey);
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("argentinaUploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  return <section className="overflow-hidden rounded-2xl border border-black/10 bg-[var(--paper)] shadow-[var(--shadow-soft)]" aria-labelledby="argentina-transfer-title">
    <header className="border-b border-black/10 px-6 py-8 sm:px-10 sm:py-10">
      <p className="eyebrow text-xs">{t("bankTransferTitle")}</p>
      <h1 id="argentina-transfer-title" className="display-font mt-3 text-4xl text-[var(--walnut)] sm:text-6xl">{t("argentinaTransferHeading")}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-black/60 sm:text-base">{t("argentinaTransferIntro")}</p>
    </header>

    <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="order-2 space-y-7 px-6 py-8 sm:px-10 sm:py-10 lg:order-1">
        <div className="hidden rounded-xl border border-[#b8a88a]/35 bg-[var(--cream)] p-5 lg:block">
          <p className="text-sm text-black/60">{t("argentinaOrderTotal")}</p>
          <p className="mt-1 text-3xl font-bold text-[var(--walnut)]">{formatMoney(totalMinor, "ARS", locale)}</p>
        </div>
        <p className="rounded-xl border border-[#b8a88a]/35 p-4 text-sm leading-6 text-[var(--walnut)]">{t("argentinaShippingNotice")}</p>
        <ol className="space-y-5 text-sm leading-6 text-[var(--walnut)]">
          <li className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#6b7a4a] text-xs font-bold text-white">1</span><span>{t("argentinaTransferStepOne")}</span></li>
          <li className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#6b7a4a] text-xs font-bold text-white">2</span><span>{t("argentinaTransferStepTwo")}</span></li>
        </ol>
        <Link href={{ pathname: "/pedidos/[id]", params: { id: orderId } }} className="inline-block text-sm font-semibold underline underline-offset-4">{t("argentinaViewOrder")}</Link>
      </div>

      <aside className="order-1 bg-[#918f78] px-6 py-8 text-white sm:px-8 sm:py-10 lg:order-2" aria-label={t("bankTransferTitle")}>
        <div className="mb-6 border-b border-white/30 pb-5 lg:hidden"><p className="text-sm text-white/80">{t("argentinaOrderTotal")}</p><p className="mt-1 text-3xl font-bold">{formatMoney(totalMinor, "ARS", locale)}</p></div>
        <div className="flex items-center gap-2"><Bank size={22} aria-hidden="true" /><h2 className="text-lg font-bold">{t("bankTransferTitle")}</h2></div>
        <p className="mt-2 text-sm leading-6 text-white/85">{t("argentinaBankInstructions")}</p>
        <dl className="mt-5 space-y-4 rounded-xl border border-white/20 bg-black/10 p-4 text-sm">
          {bankEntries.map(([key, label]) => <div key={key}><dt className="text-xs text-white/70">{label}</dt><dd className="mt-1 break-all font-bold select-all">{String(bank[key] || "—")}</dd></div>)}
        </dl>

        {rejectionReason && canUpload && <p role="alert" className="mt-5 rounded-xl border border-white/30 bg-[#512d26] p-3 text-sm leading-6">{t("argentinaReceiptRejected", { reason: rejectionReason })}</p>}
        {canUpload && (!transferConfirmed ? <button type="button" onClick={() => setTransferConfirmed(true)} className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border border-white/70 px-5 text-sm font-bold transition hover:bg-white/10 focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--paper)]">{t("transferMade")}</button> :
          <form onSubmit={submit} className="mt-5 rounded-xl border border-white/25 bg-white/10 p-4">
            <label htmlFor="argentina-transfer-receipt" className="block text-sm font-bold">{t("receiptLabel")}</label>
            <p id="argentina-transfer-receipt-help" className="mt-1 text-xs leading-5 text-white/75">{t("receiptHelp")}</p>
            <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/70 px-4 text-center text-sm font-semibold transition hover:bg-white/10 focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-white">
              <UploadSimple size={20} aria-hidden="true" />
              <span className="min-w-0 break-all">{receipt ? receipt.name : t("chooseReceipt")}</span>
              <input id="argentina-transfer-receipt" type="file" name="receipt" accept="image/jpeg,image/png,image/webp,application/pdf" aria-describedby="argentina-transfer-receipt-help" className="sr-only" required onChange={event => {
                const next = event.target.files?.[0] || null;
                if (next && next.size > 5 * 1024 * 1024) { setReceipt(null); setError(t("receiptTooLarge")); event.currentTarget.value = ""; return; }
                if (next && !receiptTypes.has(next.type)) { setReceipt(null); setError(t("receiptInvalidType")); event.currentTarget.value = ""; return; }
                setError(""); setReceipt(next); sessionStorage.removeItem(`argentina_receipt_${orderId}`);
              }} />
            </label>
            <button type="submit" disabled={busy || !receipt} className="mt-4 flex min-h-13 w-full items-center justify-center rounded-xl bg-[var(--walnut)] px-6 text-sm font-bold text-[var(--paper)] transition hover:bg-[#4a2a1c] disabled:cursor-not-allowed disabled:opacity-50">{busy ? t("uploadingReceipt") : t("completeOrder")}</button>
          </form>)}
        {status === "payment_verification_pending" && <p role="status" className="mt-5 rounded-xl border border-white/30 bg-white/10 p-4 text-sm leading-6">{t("argentinaReceiptReceived")}</p>}
        {!canUpload && status !== "payment_verification_pending" && <p role="status" className="mt-5 text-sm">{t("argentinaViewStatus")}</p>}
        {error && <p role="alert" className="mt-4 text-sm font-semibold">{error}</p>}
      </aside>
    </div>
  </section>;
}
