import type { State, WholesaleConsignment, WholesaleConsignmentLine } from "./data";

export type ConsignmentLineBalance = WholesaleConsignmentLine & {
  dispatched: number; returned: number; kept: number; held: number;
  availableToDispatch: number; confirmedArgMinor: number;
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
      availableToDispatch: line.quantity - dispatched, confirmedArgMinor: kept * line.unitPriceArgMinor };
  });
}

export function consignmentSummary(state: State, consignment: WholesaleConsignment) {
  const lines = consignmentLineBalances(state, consignment.id);
  const sum = (value: (line: ConsignmentLineBalance) => number) => lines.reduce((total, line) => total + value(line), 0);
  const confirmedArgMinor = sum((line) => line.confirmedArgMinor);
  const paidArgMinor = (state.consignmentAllocations || [])
    .filter((allocation) => allocation.consignmentId === consignment.id)
    .reduce((total, allocation) => total + allocation.sourceAmountMinor, 0);
  const planned = sum((line) => line.quantity);
  const dispatched = sum((line) => line.dispatched);
  const held = sum((line) => line.held);
  const returned = sum((line) => line.returned);
  const kept = sum((line) => line.kept);
  return { lines, planned, dispatched, held, returned, kept, confirmedArgMinor, paidArgMinor,
    balanceArgMinor: Math.max(0, confirmedArgMinor - paidArgMinor),
    status: held > 0 || dispatched < planned ? "En curso" : confirmedArgMinor > paidArgMinor ? "Por cobrar" : "Cerrada" };
}

export function consignmentReceiptAvailableMinor(state: State, receiptId: string): number {
  const receipt = (state.accountReceipts || []).find((row) => row.id === receiptId);
  if (!receipt || receipt.currency !== "ARS") return 0;
  const ordinary = (state.accountAllocations || []).filter((row) => row.receiptId === receiptId)
    .reduce((total, row) => total + (row.sourceAmountMinor || 0), 0);
  const consigned = (state.consignmentAllocations || []).filter((row) => row.receiptId === receiptId)
    .reduce((total, row) => total + row.sourceAmountMinor, 0);
  return Math.max(0, receipt.sourceAmountMinor - ordinary - consigned);
}
