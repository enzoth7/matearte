import { es } from "@/content/es";

export const whatsappConsultationMessage = "Hola, quería hacer una consulta.";

export function buildWhatsAppUrl(phone: string, message: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export const whatsappConsultationUrl = buildWhatsAppUrl(es.contact.phoneHref, whatsappConsultationMessage);
