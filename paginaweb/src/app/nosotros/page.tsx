import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { editorialMedia } from "@/data/catalog";

export const metadata: Metadata = {
  title: "Nosotros",
  description: "La historia familiar y artesanal de MateArte en Paysandú.",
  alternates: { canonical: "/nosotros" },
};

const timeline = [
  { year: "+25 años", title: "La Unión Artesanías", body: "La familia Ortiz comienza en Paysandú vendiendo artículos regionales a comerciantes de distintos puntos del Uruguay." },
  { year: "2015", title: "Dos orillas, un oficio", body: "La historia provista por la marca sitúa una nueva sucursal de producción en Colón, Entre Ríos, y la ampliación hacia termos, materas y venta directa." },
  { year: "2019", title: "Nace MateArte", body: "El proyecto renueva su identidad y adopta el nombre que hoy lo representa: arte, tradición y piezas que cuentan historias propias." },
  { year: "Hoy", title: "Paysandú hacia el mundo", body: "Con presencia en Uruguay y Argentina, la marca comunica ventas mayoristas, minoristas y envíos internacionales." },
];

export default function NosotrosPage() {
  return (
    <main id="contenido">
      <section className="section-space">
        <div className="container-shell grid gap-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="eyebrow text-[var(--leather)]">Nosotros</p>
            <h1 className="display-xl mt-7">Una tradición familiar con nombre propio.</h1>
          </div>
          <p className="text-lg leading-8 text-black/65 lg:col-span-4 lg:col-start-9">MateArte nació en Paysandú, entre artículos regionales, herramientas, materiales y una familia que hizo del oficio su forma de crecer.</p>
        </div>
      </section>
      <section className="container-shell pb-20 md:pb-32">
        <div className="relative aspect-[16/9] min-h-[26rem] overflow-hidden"><Image src={editorialMedia.hero.src} alt={editorialMedia.hero.alt} fill sizes="100vw" className="object-cover object-center" priority /></div>
      </section>
      <section className="section-space bg-[var(--paper)]">
        <div className="container-shell">
          <p className="eyebrow text-[var(--yerba)]">Recorrido</p>
          <div className="mt-12">
            {timeline.map((item, index) => (
              <Reveal key={item.year} delay={Math.min(index * 0.035, 0.1)}>
                <article className="grid gap-4 border-t border-black/20 py-8 md:grid-cols-12 md:py-12">
                  <p className="text-sm font-semibold tracking-[0.16em] text-[var(--leather)] uppercase md:col-span-2">{item.year}</p>
                  <h2 className="display-font text-3xl md:col-span-4 md:text-4xl">{item.title}</h2>
                  <p className="max-w-2xl text-base leading-8 text-black/62 md:col-span-5 md:col-start-8">{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <p className="legal-note mt-8">La cronología se basa en la narrativa pública recopilada. Fechas y hitos deben ser validados por MateArte antes de una publicación definitiva.</p>
        </div>
      </section>
      <section className="section-space">
        <div className="container-shell grid gap-12 md:grid-cols-12 md:items-center">
          <div className="md:col-span-5"><div className="relative aspect-[4/5] overflow-hidden"><Image src={editorialMedia.craft.src} alt={editorialMedia.craft.alt} fill sizes="50vw" className="object-cover" /></div></div>
          <div className="md:col-span-6 md:col-start-7">
            <p className="eyebrow text-[var(--leather)]">Lo que permanece</p>
            <h2 className="display-lg mt-7">Calidad que se ve de cerca.</h2>
            <p className="mt-7 text-lg leading-8 text-black/65">El valor aparece en una costura firme, un borde bien resuelto y un grabado que conversa con la forma. No se trata de producir objetos idénticos, sino piezas cuidadas.</p>
            <Link className="button-primary mt-8" href="/catalogo">Explorar catálogo</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
