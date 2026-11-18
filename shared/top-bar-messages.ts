/** Mensajes de la barra negra fija sobre el encabezado de la web (tabla site_top_bar_messages). */
export type TopBarAction = "none" | "subscribe" | "link";

export type TopBarMessageRow = {
  id: string;
  text_es: string;
  text_en: string | null;
  text_pt: string | null;
  action: TopBarAction;
  action_label: string | null;
  link_url: string | null;
  sort_order: number;
  enabled: boolean;
};

export const TOP_BAR_MESSAGE_COLUMNS = "id,text_es,text_en,text_pt,action,action_label,link_url,sort_order,enabled";

/** Texto en el idioma pedido; si falta la traducción se usa el español. */
export function topBarText(row: Pick<TopBarMessageRow, "text_es" | "text_en" | "text_pt">, locale: string): string {
  const translated = locale === "en" ? row.text_en : locale === "pt" ? row.text_pt : row.text_es;
  return translated?.trim() || row.text_es.trim();
}

export function validTopBarLink(value: string): boolean {
  return /^(\/|https:\/\/)/.test(value.trim());
}
