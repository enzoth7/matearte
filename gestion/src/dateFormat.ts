const montevideo = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

const parts = (value: Date) => {
  const found = montevideo.formatToParts(value);
  const part = (type: string) => found.find((item) => item.type === type)?.value || "";
  return { day: part("day"), month: part("month"), year: part("year"), hour: part("hour"), minute: part("minute") };
};

/** Fecha en formato DD/MM/AAAA. Acepta "AAAA-MM-DD" o una marca de tiempo (se pasa a hora de Montevideo). */
export function formatDate(value?: string | Date | null, empty = "—") {
  if (!value) return empty;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : empty;
  const { day, month, year } = parts(date);
  return `${day}/${month}/${year}`;
}

/** Fecha y hora en formato DD/MM/AAAA HH:mm, hora de Montevideo. */
export function formatDateTime(value?: string | Date | null, empty = "—") {
  if (!value) return empty;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : empty;
  const { day, month, year, hour, minute } = parts(date);
  return `${day}/${month}/${year} ${hour}:${minute}`;
}
