import { describe, expect, it } from "vitest";
import { customerDisplayChannel, customerOriginClass, customerOriginLabel, customerOriginOptions } from "./customerChannel";
import type { Customer, Order } from "./data";

const customer = { id: "agenda-1", name: "Ana", segment: "Minorista", sourceChannels: ["Agenda"] } as Customer;
const order = (id: string, date: string, channel: Order["channel"]) => ({ id, date, channel, customerId: customer.id }) as Order;

describe("canal visible del cliente", () => {
  it("comparte diez orígenes y colores con Marketing", () => {
    expect(customerOriginOptions).toHaveLength(10);
    expect(customerOriginLabel("footer")).toBe("Suscripción");
    expect(customerOriginLabel("welcome:instagram")).toBe("Suscripción con desc.");
    expect(customerOriginClass("Suscripción")).toBe("channel-footer");
    expect(customerOriginClass("welcome:instagram")).toBe("channel-welcome");
    expect(customerOriginClass("Feria")).toBe("channel-feria");
    expect(customerOriginClass("Registros web")).toBe("channel-web");
  });
  it("deja Agenda solo cuando no hay otro canal", () => {
    expect(customerDisplayChannel(customer, [])).toBe("Agenda");
    expect(customerDisplayChannel({ ...customer, sourceChannels: ["Agenda", "Sorteo"] }, [])).toBe("Agenda");
  });

  it("conserva Agenda cuando compra después", () => {
    expect(customerDisplayChannel(customer, [order("1", "2026-10-15", "Local")])).toBe("Agenda");
  });

  it("conserva el canal de la primera compra sin acumular etiquetas", () => {
    expect(customerDisplayChannel({ ...customer, sourceChannels: [] }, [
      order("2", "2026-10-15", "WhatsApp"),
      order("1", "2026-10-12", "Local"),
    ])).toBe("Local");
  });

  it("mantiene Web tras una compra posterior en el local", () => {
    expect(customerDisplayChannel({ ...customer, originChannel: "Web" }, [order("2", "2026-10-16", "Local"), order("1", "2026-10-10", "Web")])).toBe("Web");
  });

  it("mantiene Sorteo como origen aunque compre después en el local", () => {
    expect(customerDisplayChannel({ ...customer, sourceChannels: ["Sorteo"] }, [order("2", "2026-10-16", "Local")])).toBe("Sorteo");
  });

  it("muestra WhatsApp como origen de los mayoristas históricos", () => {
    expect(customerDisplayChannel({ ...customer, segment: "Mayorista", sourceChannels: [] , wholesaleName: "Ana" }, [])).toBe("WhatsApp");
  });
});
