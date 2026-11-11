import { arsMoney, balance, money, wholesaleBalanceOriginal, wholesaleTotalOriginal, type Customer, type CustomerAccountAllocation, type CustomerAccountReceipt, type Order, type State, type WholesaleConsignment, type WholesaleConsignmentAllocation } from "./data";
import { consignmentSummary } from "./consignmentModel";

export type CustomerAccount = {
  id: string;
  contactId: string;
  currency: "ARS" | "UYU";
  customer: Customer;
  orders: Order[];
  consignments: WholesaleConsignment[];
  receipts: CustomerAccountReceipt[];
  allocations: CustomerAccountAllocation[];
  consignmentAllocations: WholesaleConsignmentAllocation[];
  pending: number;
  credit: number;
  unknownOrders: number;
  wholesalePending: number;
  depositPending: number;
  creditSalePending: number;
  otherPending: number;
};
export const accountMoney = (account: CustomerAccount, amount: number) => account.currency === "ARS" ? arsMoney(amount) : money(amount);
export const accountOrderBalance = (state: State, order: Order) => order.consignmentId
  ? (state.consignments || []).filter((entry) => entry.id === order.consignmentId)
    .reduce((sum, entry) => sum + consignmentSummary(state, entry).balanceMinor / 100, 0)
  : order.source === "wholesale" ? wholesaleBalanceOriginal(state, order) : balance(state, order);
export const accountOrderTotal = (state: State, order: Order) => order.consignmentId
  ? (state.consignments || []).filter((entry) => entry.id === order.consignmentId)
    .reduce((sum, entry) => sum + consignmentSummary(state, entry).confirmedMinor / 100, 0)
  : order.source === "wholesale" ? wholesaleTotalOriginal(order) : order.totalAmount ?? order.quantity * order.unitPrice;

export function customerAccounts(state: State): CustomerAccount[] {
  const byAccount = new Map<string, CustomerAccount>();
  const contactByCustomer = new Map(state.customers.map((customer) => [customer.id, customer.contactId]));
  const customerById = new Map(state.customers.map((customer) => [customer.id, customer]));
  const customerByContact = new Map(state.customers.filter((customer) => customer.contactId).map((customer) => [customer.contactId!, customer]));
  const ensure = (contactId: string, currency: "ARS" | "UYU", fallback?: Customer) => {
    const id = `${contactId}:${currency}`;
    let account = byAccount.get(id);
    if (!account) {
      account = { id, contactId, currency, customer: fallback || customerByContact.get(contactId) || {
        id: `contact:${contactId}`, contactId, name: "Cliente sin nombre", email: "", phone: "", city: "", segment: currency === "ARS" ? "Mayorista" : "Minorista",
      }, orders: [], consignments: [], receipts: [], allocations: [], consignmentAllocations: [], pending: 0, credit: 0, unknownOrders: 0,
      wholesalePending: 0, depositPending: 0, creditSalePending: 0, otherPending: 0 };
      byAccount.set(id, account);
    }
    if (fallback?.localCustomerId && !account.customer.localCustomerId) account.customer = { ...account.customer, localCustomerId: fallback.localCustomerId };
    return account;
  };
  for (const customer of state.customers) {
    if (customer.contactId) ensure(customer.contactId, customer.segment === "Mayorista" ? "ARS" : "UYU", customer);
  }
  for (const order of state.orders) {
    if (order.source !== "local" && order.source !== "wholesale") continue;
    const contactId = order.contactId || contactByCustomer.get(order.customerId) || "";
    if (!contactId) continue;
    const known = customerById.get(order.customerId);
    const linkedConsignment = order.consignmentId && (state.consignments || []).find((entry) => entry.id === order.consignmentId);
    const account = ensure(contactId, linkedConsignment ? linkedConsignment.currency : order.source === "wholesale" ? order.wholesaleCurrency || "ARS" : "UYU", known ? { ...known, contactId }
      : { id: `contact:${contactId}`, contactId, name: order.customerName || "Cliente sin nombre", email: "", phone: "", city: "", segment: order.source === "wholesale" ? "Mayorista" : "Minorista" });
    account.orders.push(order);
    if (order.consignmentId) continue;
    const remaining = accountOrderBalance(state, order);
    if (remaining == null) { account.unknownOrders++; continue; }
    account.pending += remaining;
    if (remaining <= 0) continue;
    if (order.source === "wholesale") account.wholesalePending += remaining;
    else if (order.paymentMethod === "Cuenta corriente" || order.depositAmount === 0) account.creditSalePending += remaining;
    else if (order.depositAmount != null) account.depositPending += remaining;
    else account.otherPending += remaining;
  }
  for (const consignment of state.consignments || []) {
    const account = ensure(consignment.contactId, consignment.currency);
    account.consignments.push(consignment);
    const balance = consignmentSummary(state, consignment).balanceMinor / 100;
    account.pending += balance;
    account.wholesalePending += balance;
  }
  for (const receipt of state.accountReceipts || []) {
    ensure(receipt.contactId, receipt.currency).receipts.push(receipt);
  }
  for (const allocation of state.accountAllocations || []) {
    const receipt = (state.accountReceipts || []).find((entry) => entry.id === allocation.receiptId);
    const account = receipt && byAccount.get(`${receipt.contactId}:${receipt.currency}`);
    if (account) account.allocations.push(allocation);
  }
  for (const allocation of state.consignmentAllocations || []) {
    const receipt = (state.accountReceipts || []).find((entry) => entry.id === allocation.receiptId);
    const account = receipt && byAccount.get(`${receipt.contactId}:${receipt.currency}`);
    if (account) account.consignmentAllocations.push(allocation);
  }
  for (const account of byAccount.values()) {
    const received = account.receipts.reduce((sum, receipt) => sum + (account.currency === "ARS" ? receipt.sourceAmountMinor : receipt.amountMinor), 0);
    const applied = account.allocations.reduce((sum, allocation) => sum + (account.currency === "ARS" ? allocation.sourceAmountMinor || 0 : allocation.amountMinor), 0)
      + account.consignmentAllocations.reduce((sum, allocation) => sum + allocation.sourceAmountMinor, 0);
    account.credit = Math.max(0, received - applied) / 100;
  }
  return [...byAccount.values()].sort((a, b) =>
    Number(b.pending > 0 || b.unknownOrders > 0) - Number(a.pending > 0 || a.unknownOrders > 0)
    || b.pending - a.pending || a.customer.name.localeCompare(b.customer.name, "es"));
}

export function receiptAvailableMinor(account: CustomerAccount, receiptId: string): number {
  const receipt = account.receipts.find((entry) => entry.id === receiptId);
  return receipt ? Math.max(0, (account.currency === "ARS" ? receipt.sourceAmountMinor : receipt.amountMinor) - account.allocations
    .filter((allocation) => allocation.receiptId === receiptId)
    .reduce((sum, allocation) => sum + (account.currency === "ARS" ? allocation.sourceAmountMinor || 0 : allocation.amountMinor), 0)
    - (account.consignmentAllocations || []).filter((allocation) => allocation.receiptId === receiptId)
      .reduce((sum, allocation) => sum + allocation.sourceAmountMinor, 0)) : 0;
}
