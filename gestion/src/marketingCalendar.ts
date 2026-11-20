export type CalendarCategory = "regalo" | "online" | "turismo" | "cultura";

export type CalendarEvent = {
  id: string;
  name: string;
  category: CalendarCategory;
  /** Fechas ISO (YYYY-MM-DD). Los eventos de un solo día repiten la misma fecha. */
  start: string;
  end: string;
  description: string;
  idea: string;
};

export const categoryLabels: Record<CalendarCategory, string> = {
  regalo: "Fecha de regalo",
  online: "Compras online",
  turismo: "Turismo y movimiento",
  cultura: "Cultura y tradición",
};

const pad = (value: number) => String(value).padStart(2, "0");
const iso = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;
const fromUtc = (time: number) => { const date = new Date(time); return iso(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()); };
const addDays = (date: string, days: number) => fromUtc(Date.parse(`${date}T00:00:00Z`) + days * 86400000);

/** Día del mes del enésimo `weekday` (0 = domingo) de un mes (0 = enero). */
export function nthWeekday(year: number, month: number, weekday: number, nth: number) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
}

/** Domingo de Pascua (calendario gregoriano). */
export function easterSunday(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

/**
 * La Cámara Nacional de Comercio y Servicios fija el Día de la Madre cada año: normalmente es el
 * segundo domingo de mayo, pero en 2025 se pasó al tercero por las elecciones departamentales.
 * Agregá acá cualquier otra excepción futura.
 */
const motherDayOverrides: Record<number, string> = { 2025: "2025-05-18" };

export function calendarEvents(year: number): CalendarEvent[] {
  const easter = easterSunday(year);
  const ids = (id: string, name: string, category: CalendarCategory, start: string, end: string, description: string, idea: string): CalendarEvent => ({ id: `${id}-${year}`, name, category, start, end, description, idea });
  const blackFriday = iso(year, 10, nthWeekday(year, 10, 4, 4) + 1);
  const cyberMonday = iso(year, 10, nthWeekday(year, 10, 1, 1));
  const events: CalendarEvent[] = [
    ids("reyes", "Día de Reyes", "regalo", iso(year, 0, 6), iso(year, 0, 6), "Fecha tradicional de regalos a comienzos de año.", "Combos de mate y accesorios para regalar."),
    ids("san-valentin", "San Valentín", "regalo", iso(year, 1, 14), iso(year, 1, 14), "Día de los Enamorados: regalos en pareja.", "Combos de dos mates y mates personalizados con iniciales."),
    ids("carnaval", "Carnaval", "turismo", addDays(easter, -48), addDays(easter, -47), "Lunes y martes de Carnaval, con feriado y escapadas.", "Mates y termos para viajar."),
    ids("mujer", "Día Internacional de la Mujer", "regalo", iso(year, 2, 8), iso(year, 2, 8), "Fecha de regalos.", "Selección de mates para regalar."),
    ids("cerveza", "Semana de la Cerveza", "turismo", addDays(easter, -8), easter, "Se hace en Paysandú durante la Semana de Turismo.", "Promo con envío al litoral."),
    ids("turismo", "Semana de Turismo", "turismo", addDays(easter, -6), easter, "Semana de mayor movimiento turístico interno del año.", "Mates y termos para viajar."),
    ids("madre", "Día de la Madre", "regalo", motherDayOverrides[year] ?? iso(year, 4, nthWeekday(year, 4, 0, 2)), motherDayOverrides[year] ?? iso(year, 4, nthWeekday(year, 4, 0, 2)), "Segundo domingo de mayo, una de las fechas de regalo más importantes.", "Mates personalizados y combos con bombilla."),
    ids("padre", "Día del Padre", "regalo", iso(year, 6, nthWeekday(year, 6, 0, 2)), iso(year, 6, nthWeekday(year, 6, 0, 2)), "En Uruguay se celebra el segundo domingo de julio.", "Mates de cuero y virola, grabados con nombre."),
    ids("amigo", "Día del Amigo", "regalo", iso(year, 6, 20), iso(year, 6, 20), "Se celebra el 20 de julio.", "Combos de mate para regalar."),
    ids("nostalgia", "Noche de la Nostalgia", "cultura", iso(year, 7, 24), iso(year, 7, 24), "Noche tradicional uruguaya, el 24 de agosto.", "Contenido de mate y tradición uruguaya."),
    ids("expo-prado", "Expo Prado (Rural del Prado)", "cultura", iso(year, 8, nthWeekday(year, 8, 5, 2)), addDays(iso(year, 8, nthWeekday(year, 8, 5, 2)), 9), "Exposición rural en Montevideo, durante diez días en setiembre. Fecha a confirmar cada año.", "Mates de cuero y bombillas para el público del campo."),
    ids("meseta", "Encuentro con el Patriarca (Meseta de Artigas)", "cultura", iso(year, 8, nthWeekday(year, 8, 4, 4)), addDays(iso(year, 8, nthWeekday(year, 8, 4, 4)), 3), "Fiesta criolla en la Meseta de Artigas, Paysandú. Fecha a confirmar cada año.", "Mates de cuero para el público criollo."),
    ids("patrimonio", "Día del Patrimonio", "cultura", iso(year, 9, nthWeekday(year, 9, 6, 1)), iso(year, 9, nthWeekday(year, 9, 6, 1) + 1), "Primer fin de semana de octubre.", "Contenido del proceso artesanal del mate."),
    ids("ciberlunes", "Ciberlunes Uruguay", "online", cyberMonday, addDays(cyberMonday, 2), "Compras online en Uruguay, a comienzos de noviembre. Fecha a confirmar cada año.", "Descuento general en la web."),
    ids("black-friday", "Black Friday", "online", blackFriday, blackFriday, "Viernes posterior a Acción de Gracias, con ofertas online.", "Descuento general en la web."),
    ids("dia-mate", "Día Nacional del Mate", "cultura", iso(year, 10, 30), iso(year, 10, 30), "Se celebra el 30 de noviembre en Argentina.", "Contenido y promo de mate."),
    ids("navidad", "Nochebuena y Navidad", "regalo", iso(year, 11, 24), iso(year, 11, 25), "Temporada de regalos más importante del año.", "Regalos personalizados."),
    ids("fin-de-ano", "Fin de Año", "regalo", iso(year, 11, 31), iso(year, 11, 31), "Cierre del año.", "Descuento sobre stock disponible."),
  ];
  return events.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name, "es"));
}

/** Eventos del año indexados por cada día que cubren. */
export function eventsByDay(year: number) {
  const days = new Map<string, CalendarEvent[]>();
  for (const event of calendarEvents(year)) {
    for (let day = event.start; day <= event.end; day = addDays(day, 1)) {
      if (!day.startsWith(`${year}-`)) continue;
      days.set(day, [...(days.get(day) || []), event]);
    }
  }
  return days;
}

/** Fecha de hoy en Uruguay (YYYY-MM-DD). */
export function todayInUruguay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function longDate(date: string) {
  return new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function shortDate(date: string) {
  return new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function eventRange(event: Pick<CalendarEvent, "start" | "end">) {
  return event.start === event.end ? shortDate(event.start) : `${shortDate(event.start)} al ${shortDate(event.end)}`;
}
