export type TimeEntry = {
  id: string;
  employee_name: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  source: "gestion" | "planilla";
};

export const personnel = ["Nicolas", "Daniel", "Julio", "Alejandro", "Florencia P", "Florencia C", "Dario"];

export function shiftMonth(month: string, amount: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + amount, 1)).toISOString().slice(0, 7);
}

export function monthDays(month: string) {
  const [year, number] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

export function validTime(value: string | null) {
  return value !== null && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

export function workedMinutes(entry: Pick<TimeEntry, "clock_in" | "clock_out">) {
  if (!validTime(entry.clock_in) || !validTime(entry.clock_out)) return null;
  const [inHour, inMinute] = entry.clock_in!.split(":").map(Number);
  const [outHour, outMinute] = entry.clock_out!.split(":").map(Number);
  const minutes = outHour * 60 + outMinute - inHour * 60 - inMinute;
  return minutes > 0 ? minutes : null;
}

export function duration(minutes: number) {
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}
