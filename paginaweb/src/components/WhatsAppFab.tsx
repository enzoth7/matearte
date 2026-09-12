import Image from "next/image";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { es } from "@/content/es";

const WEB_MESSAGE = "Hola! Vengo de la web y quería hacer una consulta";

const href = buildWhatsAppUrl(es.contact.phoneHref, WEB_MESSAGE);

export function WhatsAppFab() {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Consultar por WhatsApp"
      className="whatsapp-fab"
    >
      <Image
        src="/assets/matearte/whatsapp-icon.png"
        alt=""
        width={52}
        height={52}
        aria-hidden
        className="whatsapp-fab-img"
      />
    </a>
  );
}
