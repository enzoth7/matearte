import type { Customer, CustomerSourceChannel, Order } from "./data";

export const customerOriginOptions: CustomerSourceChannel[] = [
  "Local", "Web", "WhatsApp", "Instagram", "Facebook", "Feria", "Agenda", "Sorteo", "Suscripción", "Suscripción con desc.",
];

export function customerOriginValue(value: string): string {
  if (value === "footer") return "Suscripción";
  if (value === "welcome" || value.startsWith("welcome:")) return "Suscripción con desc.";
  if (value === "customer_account") return "Web";
  if (value === "Registros web") return "Web";
  return value;
}

export function customerOriginLabel(channel: string): string {
  const origin = customerOriginValue(channel);
  return origin === "Web" ? "Registros web" : origin;
}

export function customerOriginClass(channel: string): string {
  const origin = customerOriginValue(channel);
  if (origin === "Suscripción") return "channel-footer";
  if (origin === "Suscripción con desc.") return "channel-welcome";
  return customerOriginOptions.includes(origin as CustomerSourceChannel)
    ? `channel-${origin.toLocaleLowerCase("es")}`
    : "";
}

export function customerDisplayChannel(customer: Customer, orders: Order[]): CustomerSourceChannel | null {
  if (customer.originChannel) return customer.originChannel;
  if (customer.sourceChannels?.includes("Agenda")) return "Agenda";
  if (customer.sourceChannels?.includes("Sorteo")) return "Sorteo";
  const firstOrder = orders.reduce<Order | null>((first, order) => {
    if (!first || order.date < first.date || (order.date === first.date && order.id < first.id)) return order;
    return first;
  }, null);
  if (firstOrder) return firstOrder.channel === "Mayorista" ? "WhatsApp" : firstOrder.channel;
  return customer.sourceChannels?.[0] || (customer.wholesaleName || customer.segment === "Mayorista" ? "WhatsApp" : null);
}
