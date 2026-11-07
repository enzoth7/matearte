import { balance, total, isSale, wholesaleBalanceArs, type State } from "./data";
import { montevideoToday } from "./overview";
import { buildExpenseForecast, buildRevenueForecast, type RevenueModel } from "./revenueForecast";

export type FinanceMonth = {
  key: string;
  label: string;
  actualIncome: number;
  receivable: number;
  estimatedIncome: number;
  income: number;
  actualExpense: number;
  payable: number;
  estimatedExpense: number;
  expense: number;
  opening: number;
  result: number;
  cumulative: number;
};

function addMonths(month: string, amount: number) {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + amount, 1)).toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("es-UY", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

export function buildFinanceProjection(
  state: State,
  { asOf = montevideoToday(), growthPercent = 0, openingBalance = 0, model = "linear" }:
    { asOf?: string; growthPercent?: number; openingBalance?: number; model?: RevenueModel } = {},
): FinanceMonth[] {
  const currentMonth = asOf.slice(0, 7);
  const baselineIncome = state.orders
    .filter((order) => isSale(order) && order.date.startsWith(currentMonth))
    .reduce((sum, order) => sum + total(order), 0);
  const baselineExpense = state.expenses
    .filter((expense) => expense.date.startsWith(currentMonth))
    .reduce((sum, expense) => sum + expense.amount, 0);
  const forecast = buildRevenueForecast(state, { asOf, growthPercent });
  const expenseForecast = buildExpenseForecast(state, { asOf });
  const appliedByReceipt = new Map<string, number>();
  for (const allocation of state.accountAllocations || []) {
    const receipt = (state.accountReceipts || []).find((entry) => entry.id === allocation.receiptId);
    const amount = receipt?.currency === "ARS" ? allocation.sourceAmountMinor || 0 : allocation.amountMinor;
    appliedByReceipt.set(allocation.receiptId, (appliedByReceipt.get(allocation.receiptId) || 0) + amount);
  }
  const freeCreditByContact = new Map<string, number>();
  for (const receipt of state.accountReceipts || []) {
    const key = `${receipt.contactId}:${receipt.currency}`;
    const amount = receipt.currency === "ARS" ? receipt.sourceAmountMinor : receipt.amountMinor;
    freeCreditByContact.set(key, (freeCreditByContact.get(key) || 0)
      + Math.max(0, amount - (appliedByReceipt.get(receipt.id) || 0)));
  }
  const collectibleByOrder = new Map<string, number>();
  for (const order of [...state.orders].sort((a, b) => (a.due || a.date).localeCompare(b.due || b.date))) {
    const remainingMinor = Math.round(balance(state, order) * 100);
    const currency = order.source === "wholesale" ? "ARS" : "UYU";
    const key = `${order.contactId || ""}:${currency}`;
    const availableMinor = order.contactId ? freeCreditByContact.get(key) || 0 : 0;
    const remainingSourceMinor = order.source === "wholesale" ? Math.round((wholesaleBalanceArs(state, order) || 0) * 100) : remainingMinor;
    const creditUsed = Math.min(remainingSourceMinor, availableMinor);
    const rate = order.source === "wholesale" && order.wholesaleTotalArg ? (order.wholesaleTotalUyu || 0) / order.wholesaleTotalArg : 1;
    collectibleByOrder.set(order.id, Math.max(0, remainingMinor - Math.round(creditUsed * rate)) / 100);
    if (order.contactId && creditUsed) freeCreditByContact.set(key, availableMinor - creditUsed);
  }
  let cumulative = Number.isFinite(openingBalance) ? openingBalance : 0;

  return Array.from({ length: 12 }, (_, index) => {
    const key = addMonths(currentMonth, index);
    const scheduledMonth = (date: string) => date.slice(0, 7) < currentMonth ? currentMonth : date.slice(0, 7);
    const actualIncome = state.payments
      .filter((payment) => payment.date.startsWith(key))
      .reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
    const receivable = state.orders
      .filter((order) => scheduledMonth(order.due || order.date) === key)
      .reduce((sum, order) => sum + (collectibleByOrder.get(order.id) || 0), 0);
    const incomeTarget = forecast.months[index]?.[model]
      ?? (state.source === "commerce" ? 0 : Math.round(baselineIncome * (1 + growthPercent / 100) ** index));
    const estimatedIncome = index === 0 ? 0 : incomeTarget;
    const actualExpense = state.expenses
      .filter((expense) => expense.paid && expense.date.startsWith(key))
      .reduce((sum, expense) => sum + expense.amount, 0);
    const payable = state.expenses
      .filter((expense) => !expense.paid && scheduledMonth(expense.date) === key)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const expenseTarget = expenseForecast.months[index]?.[model] ?? baselineExpense;
    const estimatedExpense = index === 0 ? 0 : Math.max(0, expenseTarget - payable - actualExpense);
    const income = actualIncome + receivable + estimatedIncome;
    const expense = actualExpense + payable + estimatedExpense;
    const result = income - expense;
    const opening = cumulative;
    cumulative += result;
    return {
      key,
      label: monthLabel(key),
      actualIncome,
      receivable,
      estimatedIncome,
      income,
      actualExpense,
      payable,
      estimatedExpense,
      expense,
      opening,
      result,
      cumulative,
    };
  });
}
