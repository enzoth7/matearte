import { customerOriginLabel, customerOriginOptions } from "./customerChannel";
import { Badge } from "./ui";

const originDescriptions: Record<string, string> = {
  Local: "Cliente que llegó comprando en el local físico.",
  Web: "Cliente que creó su cuenta en la tienda online.",
  WhatsApp: "Cliente que llegó escribiendo por WhatsApp.",
  Instagram: "Cliente que llegó por Instagram, ya sea desde una publicación, una historia o un mensaje directo.",
  Facebook: "Cliente que llegó por Facebook.",
  Feria: "Cliente que conocimos en una feria o evento presencial.",
  Agenda: "Contacto importado de la agenda de contactos, que todavía no necesariamente compró.",
  Sorteo: "Persona que participó de un sorteo y dejó sus datos.",
  Suscripción: "Persona que se suscribió a las novedades desde el formulario de la web, sin beneficio de bienvenida.",
  "Suscripción con desc.": "Persona que se suscribió a las novedades a cambio del descuento de bienvenida.",
};
const channels = [
  { label: "Local", description: "Venta hecha en persona, en el local." },
  { label: "Web", description: "Pedido hecho por el cliente en la tienda online." },
  { label: "Mayorista", description: "Venta a comercios y revendedores, con sus precios y condiciones de mayorista." },
  { label: "Feria", description: "Venta hecha en una feria o evento." },
  { label: "Instagram", description: "Pedido cerrado por Instagram, normalmente por mensaje directo." },
  { label: "Facebook", description: "Pedido cerrado por Facebook o Messenger." },
  { label: "WhatsApp", description: "Pedido coordinado y cerrado por WhatsApp." },
];

export function ChannelOrigin() {
  return <div className="channel-origin-page">
    <p className="channel-origin-intro"><strong>Origen</strong> es por dónde llegó el cliente la primera vez. <strong>Canal</strong> es por dónde se hizo cada pedido. Un cliente puede tener origen Instagram y comprar después por Web.</p>
    <div className="channel-origin-grid">
      <section className="marketing-panel">
        <h2>Origen</h2>
        <div className="table-wrap"><table className="channel-origin-table"><thead><tr><th>Etiqueta</th><th>Descripción</th></tr></thead><tbody>
          {customerOriginOptions.map((origin) => <tr key={origin}><td><Badge>{customerOriginLabel(origin)}</Badge></td><td>{originDescriptions[origin] || "—"}</td></tr>)}
        </tbody></table></div>
      </section>
      <section className="marketing-panel">
        <h2>Canal</h2>
        <div className="table-wrap"><table className="channel-origin-table"><thead><tr><th>Etiqueta</th><th>Descripción</th></tr></thead><tbody>
          {channels.map((channel) => <tr key={channel.label}><td><Badge>{channel.label}</Badge></td><td>{channel.description}</td></tr>)}
        </tbody></table></div>
      </section>
    </div>
  </div>;
}
