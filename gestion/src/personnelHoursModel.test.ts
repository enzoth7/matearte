import { describe, expect, it } from "vitest";
import { monthDays, shiftMonth, workedMinutes } from "./personnelHoursModel";

describe("control de horarios", () => {
  it("navega entre meses y muestra todos los días del mes", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthDays("2026-11")).toHaveLength(30);
    expect(monthDays("2028-02")).toHaveLength(29);
  });

  it("excluye del total los datos históricos incompletos o incoherentes", () => {
    expect(workedMinutes({ clock_in: "08:30", clock_out: "16:00" })).toBe(450);
    expect(workedMinutes({ clock_in: "08:00", clock_out: null })).toBeNull();
    expect(workedMinutes({ clock_in: "08:00", clock_out: "04:00" })).toBeNull();
    expect(workedMinutes({ clock_in: "-", clock_out: "-" })).toBeNull();
  });
});
