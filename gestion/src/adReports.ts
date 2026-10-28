export type AdCurrency = "USD" | "UYU" | "ARS";
export const adCurrencies: AdCurrency[] = ["USD", "UYU", "ARS"];
export const adPlatforms = ["Meta", "Google", "TikTok", "Otra"];

export type AdCampaign = { name: string; conversations: number; cost_per_conversation_minor: number; total_minor: number };
export type AdReport = {
  id: string;
  period_start: string;
  period_end: string;
  platform: string;
  currency: AdCurrency;
  campaigns: AdCampaign[];
  deposit_minor: number;
  deposit_on: string | null;
  /** Con signo: negativo = deuda pendiente del informe anterior, positivo = saldo a favor. */
  previous_balance_minor: number;
  notes: string | null;
};

/** Importes tal como se escriben en el informe: "1.388", "20,10", "1388.5", "USD 3.780". Devuelve centavos o NaN. */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned || !/\d/.test(cleaned)) return NaN;
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  else if (cleaned.includes(",")) normalized = cleaned.replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) normalized = cleaned.replace(/\./g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
}

export const fromMinorText = (minor: number) => minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2).replace(".", ",");

export function formatMoney(minor: number, currency: AdCurrency): string {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency, currencyDisplay: "code" }).format(minor / 100).replace(/ /g, " ");
}

export function summarizeReport(report: Pick<AdReport, "campaigns" | "deposit_minor" | "previous_balance_minor">) {
  const spend = report.campaigns.reduce((sum, campaign) => sum + campaign.total_minor, 0);
  const conversations = report.campaigns.reduce((sum, campaign) => sum + campaign.conversations, 0);
  const subtotal = report.deposit_minor + report.previous_balance_minor;
  return {
    spend,
    conversations,
    averageCostMinor: conversations ? Math.round(spend / conversations) : 0,
    subtotal,
    newBalance: subtotal - spend,
  };
}

const dayFormat = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-UY", { ...options, timeZone: "UTC" });
const asDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`);

/** "19 al 26 de octubre de 2026" · "28 de septiembre al 3 de octubre de 2026". */
export function periodLabel(start: string, end: string): string {
  const a = asDate(start);
  const b = asDate(end);
  if (start === end) return dayFormat({ day: "numeric", month: "long", year: "numeric" }).format(a);
  const sameMonth = a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
  if (sameMonth) return `${a.getUTCDate()} al ${dayFormat({ day: "numeric", month: "long", year: "numeric" }).format(b)}`;
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  return `${dayFormat(sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" }).format(a)} al ${dayFormat({ day: "numeric", month: "long", year: "numeric" }).format(b)}`;
}

const shortDate = (value: string) => dayFormat({ day: "2-digit", month: "2-digit" }).format(asDate(value));

/** El mismo formato que se comparte por WhatsApp, listo para pegar. */
export function reportText(report: AdReport): string {
  const summary = summarizeReport(report);
  const money = (minor: number) => formatMoney(minor, report.currency);
  const lines = [`Detalle de campañas en el periodo ${periodLabel(report.period_start, report.period_end)}`, ""];
  for (const campaign of report.campaigns) {
    lines.push(campaign.name, `- ${campaign.conversations} conversaciones iniciadas`, `- ${money(campaign.cost_per_conversation_minor)} costo por conversación iniciada`, `- Total de campaña ${money(campaign.total_minor)}`, "");
  }
  lines.push(`TOTAL GENERAL: ${money(summary.spend)}`, "", "Disponibilidad de fondos");
  if (report.deposit_minor) lines.push(`Depósito realizado${report.deposit_on ? ` (${shortDate(report.deposit_on)})` : ""}: ${money(report.deposit_minor)}`);
  if (report.previous_balance_minor) lines.push(`${report.previous_balance_minor < 0 ? "Saldo pendiente anterior" : "Saldo a favor anterior"}: ${money(Math.abs(report.previous_balance_minor))}`);
  lines.push(`Subtotal: ${money(summary.subtotal)}`, `Total actual: ${money(summary.spend)}`, `Nuevo saldo: ${money(summary.newBalance)}`);
  if (report.notes?.trim()) lines.push("", "Importante", report.notes.trim());
  return lines.join("\n");
}
