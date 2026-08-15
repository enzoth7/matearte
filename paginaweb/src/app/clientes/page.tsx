import type { Metadata } from "next";
import Link from "next/link";
import TestimonialsSection from "@/components/ui/community-testimonial";
import { InternationalWorldMap } from "@/components/ui/international-world-map";
import { destinationCountries, testimonialRows } from "@/data/international-clients";

export const metadata: Metadata = {
  title: "Clientes alrededor del mundo",
  description: "Desde Paysandú hacia trece destinos internacionales: conocé el alcance global de las piezas de MateArte Uruguay.",
  alternates: { canonical: "/clientes" },
  openGraph: {
    title: "De Paysandú al mundo | MateArte Uruguay",
    description: "Piezas MateArte que viajaron desde Uruguay hacia Europa, América y Asia.",
    url: "/clientes",
  },
};

const testimonialsData = {
  title: "Historias que cruzan fronteras.",
  subtitle: "Una vista preliminar de cómo podrán convivir acá las experiencias de quienes eligen MateArte desde otros países.",
  rows: testimonialRows,
} as const;

export default function ClientesPage() {
  return (
    <main id="contenido">

      <section className="international-map-section" aria-labelledby="destinations-heading">
        <div className="container-shell">
          <div className="international-section-heading">
            <div>
              <p className="eyebrow text-[var(--leather)]">La tradición viaja</p>
                <h1 className="international-hero-title">Hecho acá.<br />Elegido allá.</h1>
            </div>
            <p>El ritual del mate no conoce fronteras. Desde el taller de MateArte, piezas trabajadas en cuero y metal ya encontraron su lugar en trece destinos del mundo.</p>
          </div>
        
          
          <InternationalWorldMap destinations={destinationCountries} />
          <p className="legal-note mt-10 max-w-3xl">Alcance geográfico informado para esta presentación interna. La versión pública deberá validar destinos, fechas y autorización de cualquier historia de cliente asociada.</p>
        </div>
      </section>

      <TestimonialsSection data={testimonialsData} />

      <section className="international-cta">
        <div className="container-shell international-cta-grid">
          <p className="eyebrow text-[var(--leather)]">Tu historia puede empezar acá</p>
          <h2 className="display-lg">Una pieza de Uruguay, hecha para llegar hasta vos.</h2>
          <div>
            <p>Consultanos por personalización y opciones de envío internacional. La disponibilidad y el costo se confirman de forma directa.</p>
            <Link className="button-primary mt-8" href="/contacto">Hablar con MateArte</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
