import { commerceSource } from "./commerceSource";

export async function callMarketing<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!commerceSource) throw new Error("El comercio no está conectado.");
  const { data, error } = await commerceSource.functions.invoke("marketing-workspace", { body: { action, ...payload } });
  if (error) {
    const responseBody = error.context instanceof Response
      ? await error.context.json().catch(() => null) as { error?: string } | null
      : null;
    throw new Error(responseBody?.error || error.message || "No se pudo completar la operación.");
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
