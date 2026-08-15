import type { Metadata } from "next";
import Image from "next/image";
import { editorialMedia } from "@/data/catalog";

export const metadata: Metadata = {
  title: "Personalizados",
  description: "Conocé el proceso de personalización de mates MateArte.",
  alternates: { canonical: "/personalizados" },
};

const steps = [
  { number: "01", title: "Elegí la pieza", body: "Seleccioná el formato y la base que mejor acompañen tu idea." },
  { number: "02", title: "Contá tu historia", body: "Definí iniciales, palabras, símbolos o una referencia visual." },
  { number: "03", title: "Revisá la composición", body: "El configurador permitirá observar la propuesta antes de avanzar." },
  { number: "04", title: "Confirmá con MateArte", body: "Materiales, precio, plazo y producción se validan por el canal comercial real." },
];

export default function PersonalizadosPage() {
  const customizerUrl = process.env.NEXT_PUBLIC_CUSTOMIZER_URL;
  return (
    <main id="contenido">
      <section className="section-space">
        <div className="container-shell grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <p className="eyebrow text-[var(--leather)]">Personalización</p>
            <h1 className="display-xl mt-7">Una pieza, tu historia.</h1>
            <p className="mt-7 text-lg leading-8 text-black/65">Letras, símbolos y terminaciones convierten un mate en un recuerdo propio. El proceso está pensado para revisar cada decisión antes de producir.</p>
            {customizerUrl ? (
              <a className="button-primary mt-9" href={customizerUrl} target="_blank" rel="noreferrer">Abrir configurador</a>
            ) : (
              <div className="mt-9 border-l-2 border-[var(--rawhide)] pl-5">
                <p className="font-semibold">Configurador próximamente</p>
                <p className="mt-2 text-sm leading-6 text-black/58">La landing está lista. El acceso se habilitará al configurar su URL definitiva.</p>
              </div>
            )}
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <div className="relative aspect-[4/5] overflow-hidden"><Image src={editorialMedia.personalization.src} alt={editorialMedia.personalization.alt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" priority /></div>
          </div>
        </div>
      </section>
      <section className="section-space bg-[var(--paper)]">
        <div className="container-shell">
          <p className="eyebrow text-[var(--yerba)]">Cómo funciona</p>
          <h2 className="display-lg mt-7">De la idea a la pieza.</h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <article key={step.number} className="border-t border-black/25 pt-5">
                <p className="text-xs font-semibold tracking-widest text-[var(--leather)]">{step.number}</p>
                <h3 className="display-font mt-8 text-3xl">{step.title}</h3>
                <p className="mt-4 text-sm leading-7 text-black/60">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section-space bg-[var(--walnut)] text-[var(--paper)]">
        <div className="container-shell grid gap-10 md:grid-cols-12">
          <h2 className="display-lg md:col-span-6">El oficio sigue siendo humano.</h2>
          <div className="md:col-span-5 md:col-start-8">
            <p className="text-lg leading-8 text-white/70">El configurador será una herramienta de conversación, no una promesa automática de producción. Cada combinación deberá confirmarse con MateArte.</p>
            <p className="mt-6 text-sm leading-7 text-white/48">No se procesará ningún pedido ni cobro desde esta página hasta integrar el sistema comercial definitivo.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
