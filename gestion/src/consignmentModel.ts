import type { State, WholesaleConsignment, WholesaleConsignmentLine } from "./data";

export type ConsignmentLineBalance = WholesaleConsignmentLine & {
  dispatched: number; returned: number; kept: number; held: number;
  availableToDispatch: number; confirmedMinor: number; heldValueMinor: number;
};

export function consignmentLineBalances(state: State, consignmentId: string): ConsignmentLineBalance[] {
  return (state.consignmentLines || []).filter((line) => line.consignmentId === consignmentId).map((line) => {
    const movements = (state.consignmentMovements || []).filter((movement) => movement.lineId === line.id);
    const sum = (kind: "dispatch" | "return" | "kept") => movements
      .filter((movement) => movement.kind === kind).reduce((total, movement) => total + movement.quantity, 0);
    const dispatched = sum("dispatch");
    const returned = sum("return");
    const kept = sum("kept");
    return { ...line, dispatched, returned, kept, held: dispatched - returned - kept,
      availableToDispatch: line.quantity - dispatched, confirmedMinor: kept * line.unitPriceMinor,
      heldValueMinor: (dispatched - returned - kept) * line.unitPriceMinor };
  });
}

export function consignmentSummary(state: State, consignment: WholesaleConsignment) {
  const lines = consignmentLineBalances(state, consignment.id);
  const sum = (value: (line: ConsignmentLineBalance) => number) => lines.reduce((total, line) => total + value(line), 0);
  const confirmedMinor = sum((line) => line.confirmedMinor);
  const paidMinor = (state.consignmentAllocations || [])
    .filter((allocation) => allocation.consignmentId === consignment.id)
    .reduce((total, allocation) => total + allocation.sourceAmountMinor, 0);
  const planned = sum((line) => line.quantity);
  const dispatched = sum((line) => line.dispatched);
  const held = sum((line) => line.held);
  const returned = sum((line) => line.returned);
  const kept = sum((line) => line.kept);
  return { lines, planned, dispatched, held, returned, kept, heldValueMinor: sum((line) => line.heldValueMinor),
    confirmedMinor, paidMinor, balanceMinor: Math.max(0, confirmedMinor - paidMinor),
    status: held > 0 && dispatched === planned ? "Enviado"
      : held > 0 || dispatched < planned ? "En curso" : confirmedMinor > paidMinor ? "Por cobrar" : "Cerrada" };
}

export function consignmentReceiptAvailableMinor(state: State, receiptId: string, currency?: "UYU" | "ARS"): number {
  const receipt = (state.accountReceipts || []).find((row) => row.id === receiptId);
  if (!receipt || (currency && receipt.currency !== currency)) return 0;
  const ordinary = (state.accountAllocations || []).filter((row) => row.receiptId === receiptId)
    .reduce((total, row) => total + (receipt.currency === "ARS" ? row.sourceAmountMinor || 0 : row.amountMinor), 0);
  const consigned = (state.consignmentAllocations || []).filter((row) => row.receiptId === receiptId)
    .reduce((total, row) => total + row.sourceAmountMinor, 0);
  return Math.max(0, receipt.sourceAmountMinor - ordinary - consigned);
}
