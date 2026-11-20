import { describe, expect, it } from "vitest";
import { calendarEvents, easterSunday, eventsByDay, nthWeekday, todayInUruguay } from "./marketingCalendar";

const named = (year: number, id: string) => calendarEvents(year).find((event) => event.id === `${id}-${year}`)!;

describe("calendario comercial de Uruguay", () => {
  it("calcula la Pascua", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2025)).toBe("2025-04-20");
  });
  it("encuentra el enésimo día de la semana", () => {
    expect(nthWeekday(2026, 4, 0, 2)).toBe(10);
    expect(nthWeekday(2026, 6, 0, 2)).toBe(12);
  });
  it("ubica las fechas de 2026", () => {
    expect(named(2026, "madre").start).toBe("2026-05-10");
    expect(named(2026, "padre").start).toBe("2026-07-12");
    expect(named(2026, "black-friday").start).toBe("2026-11-27");
    expect(named(2026, "ciberlunes")).toMatchObject({ start: "2026-11-02", end: "2026-11-04" });
    expect(named(2026, "navidad")).toMatchObject({ start: "2026-12-24", end: "2026-12-25" });
    expect(named(2026, "turismo")).toMatchObject({ start: "2026-03-30", end: "2026-04-05" });
    expect(named(2026, "cerveza")).toMatchObject({ start: "2026-03-28", end: "2026-04-05" });
    expect(named(2026, "carnaval")).toMatchObject({ start: "2026-02-16", end: "2026-02-17" });
    expect(named(2026, "expo-prado")).toMatchObject({ start: "2026-09-11", end: "2026-09-20" });
    expect(named(2026, "meseta")).toMatchObject({ start: "2026-09-24", end: "2026-09-27" });
  });
  it("respeta la excepción del Día de la Madre de 2025", () => {
    expect(named(2025, "madre").start).toBe("2025-05-18");
  });
  it("marca cada día de un evento de varios días", () => {
    const days = eventsByDay(2026);
    expect(days.get("2026-04-01")?.map((event) => event.id)).toEqual(expect.arrayContaining(["turismo-2026", "cerveza-2026"]));
    expect(days.get("2026-03-02")).toBeUndefined();
  });
  it("usa la fecha de Uruguay y no la del servidor", () => {
    expect(todayInUruguay(new Date("2026-11-20T01:30:00Z"))).toBe("2026-11-19");
  });
});
