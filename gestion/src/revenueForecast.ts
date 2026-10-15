import { total, isSale, type State } from "./data";
import { montevideoToday } from "./overview";

export type RevenueModel = "linear" | "logarithmic";

function shiftMonth(month: string, offset: number) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + offset, 1)).toISOString().slice(0, 7);
}

function label(month: string) {
  return new Intl.DateTimeFormat("es-UY", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00Z`));
}

function leastSquares(values: number[], transform: (index: number) => number) {
  const xs = values.map((_, index) => transform(index + 1));
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const meanY = values.reduce((sum, y) => sum + y, 0) / values.length;
  const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  const slope = denominator === 0 ? 0 : xs.reduce((sum, x, index) => sum + (x - meanX) * (values[index] - meanY), 0) / denominator;
  return (index: number) => meanY + slope * (transform(index) - meanX);
}

function buildMonthlyForecast(
  state: State,
  { asOf = montevideoToday(), growthPercent = 0 }: { asOf?: string; growthPercent?: number },
  kind: "revenue" | "expense",
) {
  const currentMonth = asOf.slice(0, 7);
  const history = Array.from({ length: 12 }, (_, index) => {
    const key = shiftMonth(currentMonth, index - 12);
    const records = kind === "revenue"
      ? state.orders.filter((order) => isSale(order) && order.date.startsWith(key)).map(total)
      : state.expenses.filter((expense) => expense.date.startsWith(key)).map((expense) => expense.amount);
    return { key, label: label(key), amount: records.reduce((sum, amount) => sum + amount, 0), hasRecords: records.length > 0 };
  });
  const coverage = history.filter((month) => month.hasRecords).length;
  if (coverage < 6) return { history, coverage, months: [] as { key: string; label: string; linear: number; logarithmic: number }[] };

  const values = history.map((month) => month.amount);
  const linearFit = leastSquares(values, (index) => index);
  const logFit = leastSquares(values, (index) => Math.log(index));
  const months = Array.from({ length: 12 }, (_, index) => {
    const key = shiftMonth(currentMonth, index);
    const adjustment = (1 + growthPercent / 100) ** index;
    // Carry the deviation of the matching month last year into each trend.
    const linear = linearFit(index + 13) + values[index] - linearFit(index + 1);
    const logarithmic = logFit(index + 13) + values[index] - logFit(index + 1);
    return {
      key,
      label: label(key),
      linear: Math.max(0, Math.round(linear * adjustment)),
      logarithmic: Math.max(0, Math.round(logarithmic * adjustment)),
    };
  });
  return { history, coverage, months };
}

export function buildRevenueForecast(
  state: State,
  options: { asOf?: string; growthPercent?: number } = {},
) {
  return buildMonthlyForecast(state, options, "revenue");
}

export function buildExpenseForecast(state: State, options: { asOf?: string } = {}) {
  return buildMonthlyForecast(state, options, "expense");
}
