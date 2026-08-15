import { useCallback, useEffect, useState } from "react";
import seed from "../data/seed.json";
import { demoRequest } from "../lib/demoDashboard";
import type {
  DashboardData,
  CustomerProfile,
  DraftOrderItem,
  Product,
  ProductionItem,
} from "../types";

const initialData = seed as DashboardData;

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No se pudo guardar el cambio.");
  return payload as T;
}

const request = import.meta.env.VITE_DASHBOARD_DATA_MODE === "api" ? apiRequest : demoRequest;

export function useDashboard() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const run = useCallback(async <T,>(action: () => Promise<T>, selectData: (result: T) => DashboardData) => {
    setError("");
    try {
      const result = await action();
      setData(selectData(result));
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "No se pudo guardar el cambio.";
      setError(message);
      throw caught;
    }
  }, []);

  useEffect(() => {
    request<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "No se pudieron cargar los datos."))
      .finally(() => setLoading(false));
  }, []);

  const addOrder = useCallback(
    async (customer: string, items: DraftOrderItem[]) => {
      const result = await run(
        () => request<{ data: DashboardData; orderId: string }>("/api/orders", {
          method: "POST",
          body: JSON.stringify({ customer, items }),
        }),
        (payload) => payload.data,
      );
      return result.orderId;
    },
    [run],
  );

  const addCustomer = useCallback(
    (customer: CustomerProfile) => run(
      () => request<DashboardData>("/api/customers", {
        method: "POST",
        body: JSON.stringify(customer),
      }),
      (payload) => payload,
    ),
    [run],
  );

  const renameCustomer = useCallback(
    (previousCustomer: string, customer: CustomerProfile) => run(
      () => request<DashboardData>(`/api/customers/${encodeURIComponent(previousCustomer)}`, {
        method: "PUT",
        body: JSON.stringify(customer),
      }),
      (payload) => payload,
    ),
    [run],
  );

  const updateProduction = useCallback(
    (item: ProductionItem) => run(
      () => request<DashboardData>(`/api/production/${encodeURIComponent(item.lineId)}`, {
        method: "PATCH",
        body: JSON.stringify(item),
      }),
      (payload) => payload,
    ),
    [run],
  );

  const completeLine = useCallback(
    (lineId: string) => run(
      () => request<DashboardData>(`/api/production/${encodeURIComponent(lineId)}/complete`, { method: "POST" }),
      (payload) => payload,
    ),
    [run],
  );

  const updateProduct = useCallback(
    (product: Product) => run(
      () => request<DashboardData>(`/api/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        body: JSON.stringify(product),
      }),
      (payload) => payload,
    ),
    [run],
  );

  const updateExchangeRate = useCallback(
    (exchangeRate: number) => run(
      () => request<DashboardData>("/api/settings/exchange-rate", {
        method: "PUT",
        body: JSON.stringify({ exchangeRate }),
      }),
      (payload) => payload,
    ),
    [run],
  );

  const resetData = useCallback(
    () => run(
      () => request<DashboardData>("/api/reset", { method: "POST" }),
      (payload) => payload,
    ),
    [run],
  );

  return {
    data,
    loading,
    error,
    addOrder,
    addCustomer,
    renameCustomer,
    updateProduction,
    completeLine,
    updateProduct,
    updateExchangeRate,
    resetData,
  };
}
