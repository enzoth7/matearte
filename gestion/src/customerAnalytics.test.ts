import { describe, expect, it } from "vitest";
import type { Customer, Order } from "./data";
import { ageOn, buildCustomerAnalytics, canonicalCountry, canonicalRegion, topWithOthers, UNSPECIFIED } from "./customerAnalytics";

const customer = (id: string, patch: Partial<Customer> = {}): Customer => ({ id, name: `Cliente ${id}`, email: "", phone: "", city: "", segment: "Minorista", ...patch });
const order = (id: string, customerId: string, status?: string): Order => ({ id, customerId, status, date: "2026-10-01", channel: "Local" } as unknown as Order);
const today = new Date(2026, 9, 27);

describe("analítica de clientes", () => {
  it("unifica el país aunque venga como código, en minúsculas o solo por ciudad", () => {
    expect(canonicalCountry({ country: "UY", city: "" })).toBe("Uruguay");
    expect(canonicalCountry({ country: "uruguay", city: "" })).toBe("Uruguay");
    expect(canonicalCountry({ country: "AR", city: "" })).toBe("Argentina");
    expect(canonicalCountry({ country: undefined, city: "Montevideo" })).toBe("Uruguay");
    expect(canonicalCountry({ country: "Sin especificar", city: "" })).toBe(UNSPECIFIED);
    expect(canonicalCountry({ country: "", city: "Ciudad inventada" })).toBe(UNSPECIFIED);
  });

  it("unifica la provincia con el nombre oficial y agrupa las variantes", () => {
    expect(canonicalRegion("Argentina", "buenos aires")).toBe(canonicalRegion("Argentina", "Buenos Aires"));
    expect(canonicalRegion("Argentina", "Provincia de Córdoba")).toBe(canonicalRegion("Argentina", "cordoba"));
    expect(canonicalRegion("Uruguay", "  ")).toBe(UNSPECIFIED);
    expect(canonicalRegion("Uruguay", undefined)).toBe(UNSPECIFIED);
    expect(canonicalRegion("Narnia", "Reino Norte")).toBe("Reino Norte");
  });

  it("calcula la edad respetando el cumpleaños y descarta fechas imposibles", () => {
    expect(ageOn("1990-10-27", today)).toBe(36);
    expect(ageOn("1990-10-28", today)).toBe(35);
    expect(ageOn("2030-01-01", today)).toBeNull();
    expect(ageOn("1800-01-01", today)).toBeNull();
    expect(ageOn("no es fecha", today)).toBeNull();
    expect(ageOn(undefined, today)).toBeNull();
  });

  it("cuenta clientes y pedidos por país y provincia, con los sin dato al final", () => {
    const customers = [
      customer("1", { country: "AR", department: "Buenos Aires" }),
      customer("2", { country: "Argentina", department: "buenos aires" }),
      customer("3", { country: "Argentina", department: "Córdoba" }),
      customer("4", { country: "Argentina" }),
      customer("5", { country: "UY", department: "Paysandú" }),
      customer("6"),
    ];
    const orders = [order("a", "1"), order("b", "1"), order("c", "2"), order("d", "5"), order("x", "3", "cancelled")];
    const result = buildCustomerAnalytics(customers, orders, today);
    expect(result.total).toBe(6);
    expect(result.withOrders).toBe(3);
    expect(result.countries.map((row) => [row.name, row.customers, row.orders])).toEqual([["Argentina", 4, 3], ["Uruguay", 1, 1], [UNSPECIFIED, 1, 0]]);
    const provinces = result.provincesByCountry.get("Argentina")!;
    expect(provinces[0]).toMatchObject({ customers: 2, orders: 3 });
    expect(provinces.at(-1)?.name).toBe(UNSPECIFIED);
    expect(provinces.find((row) => row.name === "Córdoba")).toMatchObject({ customers: 1, orders: 0 });
    expect(result.completeness.find((row) => row.label === "País")?.count).toBe(5);
    expect(result.completeness.find((row) => row.label === "Provincia o estado")?.count).toBe(4);
  });

  it("arma los rangos de edad, el promedio y la mediana solo con quienes tienen fecha", () => {
    const customers = [
      customer("1", { birthDate: "2010-01-01" }),
      customer("2", { birthDate: "2000-05-05" }),
      customer("3", { birthDate: "1991-03-03" }),
      customer("4", { birthDate: "1950-01-01" }),
      customer("5", { birthDate: "2099-01-01" }),
      customer("6"),
    ];
    const { ages } = buildCustomerAnalytics(customers, [], today);
    expect(ages.known).toBe(4);
    expect(Object.fromEntries(ages.buckets.map((bucket) => [bucket.label, bucket.customers]))).toMatchObject({ "<18": 1, "18-24": 0, "25-34": 1, "35-44": 1, "65+": 1 });
    expect(ages.buckets.reduce((sum, bucket) => sum + bucket.customers, 0)).toBe(4);
    expect(ages.average).toBeGreaterThan(30);
    expect(buildCustomerAnalytics([customer("1")], [], today).ages).toMatchObject({ known: 0, average: null, median: null });
  });

  it("cuenta altas de los últimos 12 meses y de los últimos 30 días", () => {
    const customers = [
      customer("1", { createdAt: "2026-10-20T10:00:00Z" }),
      customer("2", { createdAt: "2026-10-01T10:00:00Z" }),
      customer("3", { firstPurchaseDate: "2026-08-15" }),
      customer("4", { createdAt: "2024-01-01T10:00:00Z" }),
    ];
    const result = buildCustomerAnalytics(customers, [], today);
    expect(result.newByMonth).toHaveLength(12);
    expect(result.newByMonth.at(-1)).toMatchObject({ month: "2026-10", customers: 2 });
    expect(result.newByMonth.find((point) => point.month === "2026-08")?.customers).toBe(1);
    expect(result.newByMonth.reduce((sum, point) => sum + point.customers, 0)).toBe(3);
    expect(result.newLast30Days).toBe(2);
  });

  it("agrupa en Otros los países fuera del top, sin tocar los sin especificar", () => {
    const rows = ["A", "B", "C", "D", UNSPECIFIED].map((name, index) => ({ name, customers: 10 - index, orders: 0 }));
    const top = topWithOthers(rows, 2);
    expect(top.map((row) => row.name)).toEqual(["A", "B", "Otros", UNSPECIFIED]);
    expect(top[2]).toMatchObject({ customers: 8 + 7 });
    expect(topWithOthers(rows.slice(0, 2), 5).map((row) => row.name)).toEqual(["A", "B"]);
  });
});
