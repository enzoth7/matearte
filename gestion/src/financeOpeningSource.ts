import { commerceSource } from "./commerceSource";

export type FinanceOpening = { month: string; amountMinor: number };
type OpeningRow = { month: string; amount_minor: number };

export async function readFinanceOpenings(): Promise<FinanceOpening[]> {
  if (!commerceSource) throw new Error("El comercio no está conectado.");
  const rows: FinanceOpening[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await commerceSource.from("finance_monthly_openings")
      .select("month,amount_minor").order("month", { ascending: false }).range(start, start + 499);
    if (error) throw error;
    rows.push(...((data || []) as OpeningRow[]).map((row) => ({ month: row.month.slice(0, 7), amountMinor: Number(row.amount_minor) })));
    if (!data || data.length < 500) break;
  }
  return rows;
}

export async function saveFinanceOpening(month: string, amountMinor: number): Promise<void> {
  if (!commerceSource) throw new Error("El comercio no está conectado.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isSafeInteger(amountMinor)) {
    throw new Error("Revisá el mes y el importe del saldo.");
  }
  const { data: userResult, error: userError } = await commerceSource.auth.getUser();
  if (userError || !userResult.user) throw new Error("No se pudo identificar al usuario.");
  const { error } = await commerceSource.from("finance_monthly_openings").upsert({
    month: `${month}-01`, amount_minor: amountMinor, updated_by: userResult.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "month" });
  if (error) throw error;
}
