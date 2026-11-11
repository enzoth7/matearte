import { commerceSource } from "./commerceSource";

export type ConsigneePortalLine = {
  id: string; sku: string; title: string; quantity: number; unitPriceMinor: number;
  dispatched: number; held: number; returned: number; kept: number;
};
export type ConsigneePortalEvent = {
  id: string; date: string; kind: "dispatch" | "return" | "kept" | "receipt" | "allocation";
  detail: string; quantity: number; amountMinor: number;
};
export type ConsigneePortalConsignment = {
  id: string; reference: string; currency: "UYU" | "ARS"; createdAt: string;
  lines: ConsigneePortalLine[];
  totals: { dispatched: number; held: number; returned: number; kept: number;
    heldValueMinor: number; confirmedMinor: number; paidMinor: number;
    creditMinor: number; balanceMinor: number };
  events: ConsigneePortalEvent[];
};
export type ConsigneeDashboard = { name: string; consignments: ConsigneePortalConsignment[] };

export async function readConsigneeDashboard(): Promise<ConsigneeDashboard> {
  if (!commerceSource) throw new Error("No está configurada la conexión.");
  const { data, error } = await commerceSource.functions.invoke("gestion-consignatario", { body: {} });
  if (error || !data || !Array.isArray(data.consignments)) {
    throw new Error(data?.error || "No se pudo leer la cuenta de consignaciones.");
  }
  return data as ConsigneeDashboard;
}
