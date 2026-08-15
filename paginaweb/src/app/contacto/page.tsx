import type { Metadata } from "next";
import Link from "next/link";
import { es } from "@/content/es";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Visitá o contactá a MateArte en Paysandú, Uruguay.",
  alternates: { canonical: "/contacto" },
};

const contacts = [
  { label: "Local", value: es.contact.address, href: "https://www.google.com/maps/search/?api=1&query=25+de+Mayo+1734+Paysandu+Uruguay", external: true },
  { label: "Teléfono / WhatsApp", value: es.contact.phoneDisplay, href: `tel:${es.contact.phoneHref}` },
  { label: "Email", value: es.contact.email, href: `mailto:${es.contact.email}` },
  { label: "Instagram", value: es.contact.instagram, href: es.contact.instagramUrl, external: true },
];

export default function ContactoPage() {
  return (
    <main id="contenido">
      <section className="section-space">
        <div className="container-shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="eyebrow text-[var(--leather)]">Contacto</p>
            <h1 className="display-xl mt-7">Conversemos de tu próxima pieza.</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-black/65">Esta página no envía formularios ni confirma pedidos. Elegí un canal directo para hablar con MateArte.</p>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            {contacts.map((contact) => (
              <a key={contact.label} href={contact.href} target={contact.external ? "_blank" : undefined} rel={contact.external ? "noreferrer" : undefined} className="group block border-t border-black/20 py-6 last:border-b">
                <span className="text-xs font-semibold tracking-[0.16em] text-[var(--leather)] uppercase">{contact.label}</span>
                <span className="display-font mt-2 block break-words text-2xl transition-colors group-hover:text-[var(--leather)] md:text-3xl">{contact.value}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-[var(--yerba)] py-20 text-[var(--paper)] md:py-28">
        <div className="container-shell grid gap-10 md:grid-cols-12 md:items-center">
          <div className="md:col-span-7">
            <p className="eyebrow text-[var(--cream-deep)]">Paysandú</p>
            <h2 className="display-lg mt-7">Te esperamos en 25 de Mayo 1734.</h2>
          </div>
          <div className="md:col-span-4 md:col-start-9">
            <p className="text-base leading-8 text-white/70">Consultá directamente horarios de atención y disponibilidad antes de viajar.</p>
            <a className="button-light mt-7" href="https://www.google.com/maps/search/?api=1&query=25+de+Mayo+1734+Paysandu+Uruguay" target="_blank" rel="noreferrer">Cómo llegar</a>
          </div>
        </div>
      </section>
      <section className="section-space text-center"><p className="display-font text-4xl md:text-6xl">¿Buscás una pieza personalizada?</p><Link className="button-primary mt-8" href="/personalizados">Conocer el proceso</Link></section>
    </main>
  );
}
