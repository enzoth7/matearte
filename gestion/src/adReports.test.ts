import { describe, expect, it } from "vitest";
import { formatMoney, fromMinorText, parseAmount, periodLabel, reportText, summarizeReport, type AdReport } from "./adReports";

// El informe real del 19 al 26 de octubre.
const report: AdReport = {
  id: "r1", period_start: "2026-10-19", period_end: "2026-10-26", platform: "Meta", currency: "USD",
  campaigns: [
    { name: "Botas Iguazú", conversations: 66, cost_per_conversation_minor: 2010, total_minor: 138800 },
    { name: "Mates Personalizados", conversations: 121, cost_per_conversation_minor: 3140, total_minor: 389000 },
    { name: "Matera paso atrás", conversations: 103, cost_per_conversation_minor: 3844, total_minor: 395900 },
  ],
  deposit_minor: 1000000, deposit_on: "2026-10-19", previous_balance_minor: -378000,
  notes: "Se reemplazan 2 conjuntos de anuncios en la campaña de las botas.",
};

describe("informes de pauta", () => {
  it("reproduce las cuentas del informe: total general, subtotal y nuevo saldo", () => {
    const summary = summarizeReport(report);
    expect(summary.spend).toBe(923700);
    expect(summary.conversations).toBe(290);
    expect(summary.subtotal).toBe(622000);
    expect(summary.newBalance).toBe(-301700);
    expect(summary.averageCostMinor).toBe(3185);
  });

  it("un saldo a favor anterior suma a los fondos y un informe sin campañas no divide por cero", () => {
    expect(summarizeReport({ campaigns: [], deposit_minor: 500000, previous_balance_minor: 20000 })).toMatchObject({ spend: 0, averageCostMinor: 0, subtotal: 520000, newBalance: 520000 });
  });

  it("lee importes escritos como en los informes", () => {
    expect(parseAmount("1.388")).toBe(138800);
    expect(parseAmount("20,10")).toBe(2010);
    expect(parseAmount("20.10")).toBe(2010);
    expect(parseAmount("1.388,50")).toBe(138850);
    expect(parseAmount("USD 3.780")).toBe(378000);
    expect(parseAmount("10000")).toBe(1000000);
    expect(parseAmount("-3.017")).toBe(-301700);
    expect(parseAmount("")).toBeNaN();
    expect(parseAmount("abc")).toBeNaN();
  });

  it("muestra los importes con el código de moneda y vuelve a texto editable", () => {
    expect(formatMoney(138800, "USD")).toBe("USD 1.388,00");
    expect(formatMoney(-301700, "USD")).toContain("3.017,00");
    expect(formatMoney(2010, "ARS")).toBe("ARS 20,10");
    expect(fromMinorText(1000000)).toBe("10000");
    expect(fromMinorText(2010)).toBe("20,10");
    expect(parseAmount(fromMinorText(2010))).toBe(2010);
  });

  it("escribe el período como se lee en el informe", () => {
    expect(periodLabel("2026-10-19", "2026-10-26")).toBe("19 al 26 de octubre de 2026");
    expect(periodLabel("2026-09-28", "2026-10-04")).toBe("28 de setiembre al 4 de octubre de 2026");
    expect(periodLabel("2025-12-28", "2026-01-03")).toBe("28 de diciembre de 2025 al 3 de enero de 2026");
    expect(periodLabel("2026-10-19", "2026-10-19")).toBe("19 de octubre de 2026");
  });

  it("arma el texto para compartir con todos los datos y sin el signo de pesos", () => {
    const text = reportText(report);
    expect(text).toContain("Detalle de campañas en el periodo 19 al 26 de octubre de 2026");
    expect(text).toContain("Botas Iguazú\n- 66 conversaciones iniciadas\n- USD 20,10 costo por conversación iniciada\n- Total de campaña USD 1.388,00");
    expect(text).toContain("TOTAL GENERAL: USD 9.237,00");
    expect(text).toContain("Depósito realizado (19/10): USD 10.000,00");
    expect(text).toContain("Saldo pendiente anterior: USD 3.780,00");
    expect(text).toContain("Subtotal: USD 6.220,00");
    expect(text).toContain("Total actual: USD 9.237,00");
    expect(text).toMatch(/Nuevo saldo: .*3\.017,00/);
    expect(text).toContain("Importante\nSe reemplazan 2 conjuntos");
    expect(text).not.toContain("$");
    expect(reportText({ ...report, previous_balance_minor: 5000, notes: null })).toContain("Saldo a favor anterior: USD 50,00");
  });
});
