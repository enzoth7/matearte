import { commerceSource } from "./commerceSource";
import type { FinanceCurrency } from "./financeCurrency";

export type FinanceManualIncome = {
  id: string;
  receivedOn: string;
  category: string;
  description: string;
  amountMinor: number;
  currency: FinanceCurrency;
  exchangeRateToUyu: number | null;
};

export async function readFinanceIncome(): Promise<{ categories: string[]; incomes: FinanceManualIncome[] }> {
  if (!commerceSource) throw new Error("El comercio no está conectado.");
  const { data: categoryRows, error: categoryError } = await commerceSource.from("finance_income_categories")
    .select("name").eq("active", true).order("name");
  if (categoryError) throw categoryError;
  const incomes: FinanceManualIncome[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await commerceSource.from("finance_manual_incomes")
      .select("id,received_on,category,description,amount_minor,currency,exchange_rate_to_uyu")
      .order("received_on", { ascending: false }).range(start, start + 499);
    if (error) throw error;
    incomes.push(...(data || []).map((row) => ({
      id: String(row.id), receivedOn: String(row.received_on), category: String(row.category),
      description: String(row.description), amountMinor: Number(row.amount_minor),
      currency: (row.currency || "UYU") as FinanceCurrency,
      exchangeRateToUyu: row.exchange_rate_to_uyu == null ? null : Number(row.exchange_rate_to_uyu),
    })));
    if (!data || data.length < 500) break;
  }
  return { categories: (categoryRows || []).map((row) => String(row.name)), incomes };
}

export async function addFinanceIncomeCategory(name: string): Promise<void> {
  if (!commerceSource) throw new Error("El comercio no está conectado.");
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) throw new Error("Ingresá una categoría válida.");
  const { error } = await commerceSource.from("finance_income_categories").insert({ name: trimmed });
  if (error) throw error;
}

export async function addFinanceManualIncome(input: Omit<FinanceManualIncome, "id">): Promise<FinanceManualIncome> {
  if (!commerceSource) throw new Error("El comercio no está conectado.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn) || !input.category ||
    !input.description.trim() || input.description.trim().length > 200 ||
    !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 ||
    !["UYU", "USD", "ARS"].includes(input.currency) ||
    (input.currency !== "UYU" && (!Number.isFinite(input.exchangeRateToUyu) || !(input.exchangeRateToUyu! > 0))))
    throw new Error("Revisá los datos del ingreso y la cotización.");
  const { data: userResult, error: userError } = await commerceSource.auth.getUser();
  if (userError || !userResult.user) throw new Error("No se pudo identificar al usuario.");
  const { data, error } = await commerceSource.from("finance_manual_incomes").insert({
    received_on: input.receivedOn, category: input.category, description: input.description.trim(),
    amount_minor: input.amountMinor, currency: input.currency,
    exchange_rate_to_uyu: input.currency === "UYU" ? null : input.exchangeRateToUyu,
    created_by: userResult.user.id,
  }).select("id,received_on,category,description,amount_minor,currency,exchange_rate_to_uyu").single();
  if (error || !data) throw error || new Error("No se pudo recuperar el ingreso.");
  return { id: String(data.id), receivedOn: String(data.received_on), category: String(data.category),
    description: String(data.description), amountMinor: Number(data.amount_minor),
    currency: data.currency as FinanceCurrency,
    exchangeRateToUyu: data.exchange_rate_to_uyu == null ? null : Number(data.exchange_rate_to_uyu) };
}
