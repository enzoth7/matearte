import { balance, total, isSale, wholesaleBalanceArs, type State } from "./data";
import { montevideoToday } from "./overview";
import { buildExpenseForecast, buildRevenueForecast, type RevenueModel } from "./revenueForecast";
import { consignmentSummary } from "./consignmentModel";
import type { FinanceManualIncome } from "./financeIncomeSource";
import { financeUyuMinor } from "./financeCurrency";

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
  manualAdjustment: number;
  withdrawals: number;
  contributions: number;
  cumulative: number;
  balanceKnown: boolean;
  incomeCategories: Record<string, number>;
  expenseCategories: Record<string, number>;
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
  { asOf = montevideoToday(), startMonth, growthPercent = 0, openingBalance = 0, openingBalances, monthlyAdjustments = {}, adjustments = {}, manualIncomes = [], model = "linear" }:
    { asOf?: string; startMonth?: string; growthPercent?: number; openingBalance?: number;
      openingBalances?: Record<string, number>; monthlyAdjustments?: Record<string, number>;
      adjustments?: Record<string, { withdrawals: number; contributions: number }>;
      manualIncomes?: FinanceManualIncome[]; model?: RevenueModel } = {},
): FinanceMonth[] {
  const currentMonth = asOf.slice(0, 7);
  const firstMonth = startMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth) && startMonth < currentMonth
    ? startMonth : currentMonth;
  const projectionStart = [firstMonth,
    ...state.orders.map((order) => order.date.slice(0, 7)),
    ...state.payments.map((payment) => payment.date.slice(0, 7)),
    ...state.expenses.map((expense) => expense.date.slice(0, 7)),
    ...manualIncomes.map((income) => income.receivedOn.slice(0, 7)),
    ...Object.keys(openingBalances || {}), ...Object.keys(monthlyAdjustments), ...Object.keys(adjustments),
  ].filter((month) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month <= firstMonth).sort()[0] || firstMonth;
  const [firstYear, firstNumber] = firstMonth.split("-").map(Number);
  const [projectionYear, projectionNumber] = projectionStart.split("-").map(Number);
  const offset = (firstYear - projectionYear) * 12 + firstNumber - projectionNumber;
  const baselineIncome = state.orders
    .filter((order) => isSale(order) && !order.consignmentId && order.date.startsWith(currentMonth)
      && !order.items?.some((item) => item.orderType === "credit_category"))
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
  for (const allocation of state.consignmentAllocations || []) {
    appliedByReceipt.set(allocation.receiptId, (appliedByReceipt.get(allocation.receiptId) || 0) + allocation.sourceAmountMinor);
  }
  const freeCreditByContact = new Map<string, number>();
  const reservedCreditByConsignment = new Map<string, number>();
  for (const receipt of state.accountReceipts || []) {
    const key = `${receipt.contactId}:${receipt.currency}`;
    const amount = receipt.currency === "ARS" ? receipt.sourceAmountMinor : receipt.amountMinor;
    const available = Math.max(0, amount - (appliedByReceipt.get(receipt.id) || 0));
    if (receipt.consignmentId) {
      reservedCreditByConsignment.set(receipt.consignmentId,
        (reservedCreditByConsignment.get(receipt.consignmentId) || 0) + available);
      continue;
    }
    freeCreditByContact.set(key, (freeCreditByContact.get(key) || 0)
      + available);
  }
  const collectibleByOrder = new Map<string, number>();
  for (const order of [...state.orders].sort((a, b) => (a.due || a.date).localeCompare(b.due || b.date))) {
    if (order.consignmentId) continue;
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
  let consignmentReceivableUyu = 0;
  for (const consignment of state.consignments || []) {
    const due = consignmentSummary(state, consignment).balanceMinor;
    const key = `${consignment.contactId}:${consignment.currency}`;
    const reservedUsed = Math.min(due, reservedCreditByConsignment.get(consignment.id) || 0);
    const genericUsed = Math.min(due - reservedUsed, freeCreditByContact.get(key) || 0);
    freeCreditByContact.set(key, (freeCreditByContact.get(key) || 0) - genericUsed);
    consignmentReceivableUyu += Math.round((due - reservedUsed - genericUsed) * (consignment.currency === "ARS" ? consignment.exchangeRate : 1)) / 100;
  }
  let cumulative = Number.isFinite(openingBalance) ? openingBalance : 0;
  let balanceKnown = true;

  const orderById = new Map(state.orders.map((order) => [order.id, order]));
  const historicalWholesale = state.orders.filter((order) => order.source === "wholesale"
    && order.wholesaleHistoricalPaidAtOrder && !order.consignmentId
    && order.wholesaleTotalUyu != null && Number.isFinite(order.wholesaleTotalUyu));
  const historicalWholesaleIds = new Set(historicalWholesale.map((order) => order.id));
  const historicalWholesaleSaleIds = new Set(historicalWholesale.map((order) => order.wholesaleSaleId).filter(Boolean));
  const historicalAllocationByReceipt = new Map<string, number>();
  for (const allocation of state.accountAllocations || []) {
    if (!historicalWholesaleSaleIds.has(allocation.orderId)) continue;
    historicalAllocationByReceipt.set(allocation.receiptId,
      (historicalAllocationByReceipt.get(allocation.receiptId) || 0) + allocation.amountMinor / 100);
  }
  const addCategory = (categories: Record<string, number>, label: string, amount: number) => {
    if (amount) categories[label] = (categories[label] || 0) + amount;
  };
  const orderCategory = (source: string | undefined) => source === "wholesale" ? "Ventas mayoristas"
    : source === "local" ? "Ventas locales" : "Ventas web";
  return Array.from({ length: 12 + offset }, (_, index) => {
    const key = addMonths(projectionStart, index);
    const scheduledMonth = (date: string) => date.slice(0, 7) < currentMonth ? currentMonth : date.slice(0, 7);
    const incomeCategories: Record<string, number> = {};
    const expenseCategories: Record<string, number> = {};
    const payments = state.payments.filter((payment) => payment.date.startsWith(key)
      && !historicalWholesaleIds.has(payment.orderId));
    for (const payment of payments) {
      const source = orderById.get(payment.orderId)?.source;
      const category = payment.accountReceiptId ? "Entregas a cuenta"
        : payment.id.startsWith("wholesale-receipt:") || source === "wholesale" ? "Ventas mayoristas"
          : payment.id.startsWith("local:") || payment.id.startsWith("local-receipt:") || source === "local" ? "Ventas locales" : "Ventas web";
      const allocatedToHistorical = payment.accountReceiptId
        ? Math.min(payment.amount || 0, historicalAllocationByReceipt.get(payment.accountReceiptId) || 0) : 0;
      addCategory(incomeCategories, category, (payment.amount ?? 0) - allocatedToHistorical);
    }
    const historicalSales = historicalWholesale.filter((order) => order.date.startsWith(key))
      .reduce((sum, order) => sum + (order.wholesaleTotalUyu || 0), 0);
    addCategory(incomeCategories, "Ventas mayoristas", historicalSales);
    const activeWholesaleOpening = state.orders.filter((order) => order.source === "wholesale"
      && !order.wholesaleHistoricalPaidAtOrder && !order.consignmentId && order.date.startsWith(key))
      .reduce((sum, order) => sum + (order.wholesaleOpeningPaid || 0), 0);
    addCategory(incomeCategories, "Ventas mayoristas", activeWholesaleOpening);
    const monthManualIncomes = manualIncomes.filter((item) => item.receivedOn.startsWith(key));
    for (const item of monthManualIncomes) {
      const converted = financeUyuMinor(item.amountMinor, item.currency, item.exchangeRateToUyu);
      if (converted !== null) addCategory(incomeCategories, item.category, converted / 100);
    }
    const actualIncome = payments.reduce((sum, payment) => sum + (payment.amount ?? 0)
      - (payment.accountReceiptId ? Math.min(payment.amount || 0, historicalAllocationByReceipt.get(payment.accountReceiptId) || 0) : 0), 0) + historicalSales + activeWholesaleOpening;
    const manualIncome = monthManualIncomes.reduce((sum, item) =>
      sum + (financeUyuMinor(item.amountMinor, item.currency, item.exchangeRateToUyu) || 0) / 100, 0);
    const dueOrders = key < currentMonth ? [] : state.orders.filter((order) =>
      !historicalWholesaleIds.has(order.id) && !order.consignmentId
      && !order.items?.some((item) => item.orderType === "credit_category")
      && scheduledMonth(order.due || order.date) === key);
    for (const order of dueOrders) addCategory(incomeCategories, orderCategory(order.source), collectibleByOrder.get(order.id) || 0);
    if (key === currentMonth) addCategory(incomeCategories, "Consignaciones", consignmentReceivableUyu);
    const receivable = (key === currentMonth ? consignmentReceivableUyu : 0) + dueOrders
      .reduce((sum, order) => sum + (collectibleByOrder.get(order.id) || 0), 0);
    const forecastIndex = forecast.months.findIndex((month) => month.key === key);
    const incomeTarget = forecastIndex >= 0 ? forecast.months[forecastIndex][model]
      : state.source === "commerce" ? 0 : Math.round(baselineIncome * (1 + growthPercent / 100) ** Math.max(0, forecastIndex));
    const estimatedIncome = key <= currentMonth ? 0 : incomeTarget;
    addCategory(incomeCategories, "Ventas futuras estimadas", estimatedIncome);
    const paidExpenses = state.expenses.filter((expense) => expense.paid && expense.date.startsWith(key));
    const actualExpense = paidExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    for (const expense of paidExpenses) addCategory(expenseCategories, expense.category || "Sin categoría", expense.amount);
    const dueExpenses = key < currentMonth ? [] : state.expenses
      .filter((expense) => !expense.paid && scheduledMonth(expense.date) === key);
    const payable = dueExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    for (const expense of dueExpenses) addCategory(expenseCategories, expense.category || "Sin categoría", expense.amount);
    const expenseTarget = expenseForecast.months.find((month) => month.key === key)?.[model] ?? baselineExpense;
    const estimatedExpense = key <= currentMonth ? 0 : Math.max(0, expenseTarget - payable - actualExpense);
    addCategory(expenseCategories, "Costos futuros estimados", estimatedExpense);
    const income = actualIncome + manualIncome + receivable + estimatedIncome;
    const expense = actualExpense + payable + estimatedExpense;
    const result = income - expense;
    const withdrawals = adjustments[key]?.withdrawals || 0;
    const contributions = adjustments[key]?.contributions || 0;
    const manualAdjustment = monthlyAdjustments[key] || 0;
    if (key <= "2026-11" && openingBalances && Object.hasOwn(openingBalances, key)) {
      cumulative = openingBalances[key];
      balanceKnown = true;
    }
    const opening = cumulative;
    cumulative += result - withdrawals + contributions + manualAdjustment;
    return {
      key,
      label: monthLabel(key),
      actualIncome: actualIncome + manualIncome,
      receivable,
      estimatedIncome,
      income,
      actualExpense,
      payable,
      estimatedExpense,
      expense,
      opening,
      result,
      manualAdjustment,
      withdrawals,
      contributions,
      cumulative,
      balanceKnown,
      incomeCategories,
      expenseCategories,
    };
  }).slice(offset);
}
