import { balance, total, isSale, type State } from "./data";
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
  let cumulative = Number.isFinite(openingBalance) ? openingBalance : 0;

  return Array.from({ length: 12 }, (_, index) => {
    const key = addMonths(currentMonth, index);
    const scheduledMonth = (date: string) => date.slice(0, 7) < currentMonth ? currentMonth : date.slice(0, 7);
    const actualIncome = state.payments
      .filter((payment) => payment.date.startsWith(key))
      .reduce((sum, payment) => sum + payment.amount, 0);
    const receivable = state.orders
      .filter((order) => scheduledMonth(order.due || order.date) === key)
      .reduce((sum, order) => sum + balance(state, order), 0);
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
