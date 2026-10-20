import { describe, expect, it } from "vitest";
import { joinCustomerPhone, splitCustomerPhone } from "./customerPhone";

describe("prefijo y celular de clientes", () => {
  it("separa el prefijo de teléfonos internacionales importados", () => {
    expect(splitCustomerPhone("+59899845494", "Uruguay")).toEqual({ prefix: "+598", number: "099845494" });
    expect(splitCustomerPhone("+5491123456789", "Argentina")).toEqual({ prefix: "+54", number: "91123456789" });
    expect(splitCustomerPhone("+79265367235", "Rusia")).toEqual({ prefix: "+7", number: "9265367235" });
    expect(splitCustomerPhone("+8613812345678", "CN")).toEqual({ prefix: "+86", number: "13812345678" });
    expect(splitCustomerPhone("+61412345678", "AU")).toEqual({ prefix: "+61", number: "412345678" });
    expect(splitCustomerPhone("+351912345678", "PT")).toEqual({ prefix: "+351", number: "912345678" });
    expect(splitCustomerPhone("+971501234567", "AE")).toEqual({ prefix: "+971", number: "501234567" });
  });

  it("agrega el cero solo cuando falta en un celular uruguayo", () => {
    expect(splitCustomerPhone("91473057", "Uruguay")).toEqual({ prefix: "+598", number: "091473057" });
    expect(splitCustomerPhone("091473057", "Uruguay")).toEqual({ prefix: "+598", number: "091473057" });
    expect(splitCustomerPhone("+598091473057", "Uruguay")).toEqual({ prefix: "+598", number: "091473057" });
    expect(splitCustomerPhone("+59824001234", "Uruguay")).toEqual({ prefix: "+598", number: "24001234" });
  });

  it("no inventa un prefijo si se desconoce el país", () => {
    expect(splitCustomerPhone("99845494")).toEqual({ prefix: "", number: "99845494" });
    expect(splitCustomerPhone("+8881234567")).toEqual({ prefix: "", number: "+8881234567" });
  });

  it("guarda prefijo y número editados sin duplicar el cero uruguayo", () => {
    expect(joinCustomerPhone("+598", "099845494")).toBe("+59899845494");
    expect(joinCustomerPhone("+7", "9265367235")).toBe("+79265367235");
    expect(joinCustomerPhone("+54", "91123456789")).toBe("+5491123456789");
    expect(joinCustomerPhone("", "099845494")).toBe("099845494");
  });
});
