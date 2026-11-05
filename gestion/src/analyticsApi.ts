import { commerceSource } from './commerceSource';

export async function callAnalytics<T>(action: 'report' | 'markChange', payload: Record<string, unknown>): Promise<T> {
  if (!commerceSource) throw new Error('El comercio no está conectado.');
  const { data, error } = await commerceSource.functions.invoke('analytics-admin', { body: { action, ...payload } });
  if (error) {
    const details = error.context instanceof Response ? await error.context.json().catch(() => null) as { error?: string } | null : null;
    if (!details?.error && (error.name === 'FunctionsFetchError' || (error.context instanceof Response && error.context.status === 404))) {
      throw new Error('Analítica todavía no está activa. La base de datos ya está preparada, pero falta publicar la función del servidor que carga los recorridos.');
    }
    throw new Error(details?.error || error.message || 'No se pudo cargar Analítica.');
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
