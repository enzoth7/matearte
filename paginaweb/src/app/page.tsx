import Image from "next/image";
import Link from "next/link";
import { CategoryCard } from "@/components/CategoryCard";
import { EditorialHero } from "@/components/EditorialHero";
import { ProductCard } from "@/components/ProductCard";
import { RestrictedFeature } from "@/components/RestrictedFeature";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/SectionHeading";
import { MateArteVideoStory } from "@/components/ui/interactive-video-portfolio-scroller";
import { ScrollStackController } from "@/components/ui/scroll-stack-controller";
import { categories, editorialMedia, featuredProducts, presentationMedia } from "@/data/catalog";

export default function Home() {
  const presentationMode = process.env.NEXT_PUBLIC_PRESENTATION_MODE !== "false";

  return (
    <main id="contenido">
      <ScrollStackController />

      <div className="scroll-stack-layer scroll-stack-hero">
        <EditorialHero />
      </div>

      <section className="scroll-stack-layer scroll-stack-panel section-space overflow-hidden bg-[var(--cream)]">
        <div className="container-shell grid gap-12 md:grid-cols-12 md:items-start">
          <Reveal className="md:col-span-7">
            <p className="eyebrow text-[var(--leather)]">Arte & Tradición</p>
            <h2 className="display-lg mt-7">El mate como pieza, vínculo y memoria.</h2>
          </Reveal>
          <Reveal className="md:col-span-4 md:col-start-9 md:pt-20" delay={0.08}>
            <p className="text-lg leading-8 text-black/68">MateArte nació de una tradición familiar y creció alrededor del oficio. Cada material deja una huella: el cuero cambia con el uso, la alpaca refleja la luz y el grabado vuelve única a cada pieza.</p>
            <Link className="text-link mt-5" href="/nosotros">Conocer nuestra historia</Link>
          </Reveal>
        </div>
      </section>

      <section className="scroll-stack-layer scroll-stack-panel section-space bg-[var(--cream)]">
        <div className="container-shell">
          <div className="mb-9 flex items-end justify-between gap-6">
            <h2 className="display-md">Elegí tu ritual</h2>
            <Link className="text-link hidden sm:inline-flex" href="/catalogo">Ver todo el catálogo</Link>
          </div>
          <div className="grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
            {categories.map((category, index) => (
              <Reveal key={category.slug} delay={Math.min(index * 0.045, 0.18)}>
                <CategoryCard category={category} index={index} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="scroll-stack-layer scroll-stack-panel section-space bg-[var(--paper)]">
        <div className="container-shell">
          <SectionHeading eyebrow="Selección MateArte" title="Piezas para empezar una historia." body="Una mirada al catálogo público de la marca. Precios, stock y variantes se incorporarán desde la fuente comercial real." />
          <div className="mt-14 grid gap-x-5 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product, index) => (
              <Reveal key={product.id} delay={Math.min((index % 3) * 0.05, 0.1)}>
                <ProductCard product={product} priority={index < 3} />
              </Reveal>
            ))}
          </div>
          <div className="mt-12 text-center"><Link className="button-secondary" href="/catalogo">Descubrir todas las piezas</Link></div>
        </div>
      </section>

      <section className="scroll-stack-layer scroll-stack-panel section-space bg-[var(--yerba)] text-[var(--paper)]">
        <div className="container-shell grid items-center gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image src={editorialMedia.personalization.src} alt={editorialMedia.personalization.alt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            </div>
          </Reveal>
          <Reveal className="lg:col-span-5 lg:col-start-8" delay={0.08}>
            <p className="eyebrow text-[var(--cream-deep)]">Hecho para vos</p>
            <h2 className="display-lg mt-7">Cada mate tiene su historia.</h2>
            <p className="mt-7 text-lg leading-8 text-white/76">Iniciales, palabras, símbolos y terminaciones transforman una pieza cotidiana en algo propio. La personalización comienza con una idea y se trabaja junto a MateArte.</p>
            <Link className="button-light mt-9" href="/personalizados">Explorar personalización</Link>
          </Reveal>
        </div>
      </section>

      <section className="scroll-stack-layer scroll-stack-panel section-space bg-[var(--cream)]">
        <div className="container-shell grid gap-6 lg:grid-cols-12 lg:items-stretch">
          <Reveal className="lg:col-span-4 lg:py-14">
            <p className="eyebrow text-[var(--leather)]">El oficio</p>
            <h2 className="display-md mt-7">Manos, materia y tiempo.</h2>
            <p className="mt-6 text-base leading-8 text-black/65">Coser, cincelar, pulir, ajustar. La fabricación artesanal se reconoce en las pequeñas decisiones y en una terminación que no busca borrar la materia.</p>
          </Reveal>
          <Reveal className="lg:col-span-3" delay={0.06}>
            <div className="relative min-h-[30rem] h-full overflow-hidden"><Image src={editorialMedia.craft.src} alt={editorialMedia.craft.alt} fill sizes="30vw" className="object-cover" /></div>
          </Reveal>
          <Reveal className="lg:col-span-5" delay={0.12}>
            <div className="relative min-h-[30rem] h-full overflow-hidden"><Image src={editorialMedia.tradition.src} alt={editorialMedia.tradition.alt} fill sizes="40vw" className="object-cover" /></div>
          </Reveal>
        </div>
      </section>

      <section className="scroll-stack-layer scroll-stack-panel border-y border-black/15 bg-[var(--cream-deep)]">
        <div className="container-shell grid gap-10 py-20 md:grid-cols-12 md:items-center md:py-28">
          <div className="md:col-span-3">
            <div className="flex aspect-square items-center justify-center bg-[var(--cream)] p-10">
              {presentationMode ? (
                <Image src={presentationMedia.countryBrand.src} alt={presentationMedia.countryBrand.alt} width={presentationMedia.countryBrand.width} height={presentationMedia.countryBrand.height} className="h-auto w-full object-contain" />
              ) : (
                <div className="text-center">
                  <p className="display-font text-6xl text-[var(--yerba)]">UY</p>
                  <p className="mt-2 text-xs font-semibold tracking-[0.2em] uppercase">Marca país</p>
                </div>
              )}
            </div>
          </div>
          <div className="md:col-span-7 md:col-start-5">
            <p className="eyebrow text-[var(--yerba)]">Uruguay, naturalmente</p>
            <h2 className="display-md mt-6">Una cultura que se comparte.</h2>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-black/66">El mate atraviesa generaciones, pausas y conversaciones. MateArte presenta su vínculo con Marca País Uruguay Natural mediante el recurso provisto para esta instancia.</p>
            {presentationMode && <p className="legal-note mt-6 max-w-2xl">Uso de logo sujeto a confirmación de lineamientos y autorización antes de la publicación final.</p>}
          </div>
        </div>
      </section>

      {presentationMode && (
        <div className="scroll-stack-layer scroll-stack-panel overflow-hidden bg-[var(--ink)]">
          <MateArteVideoStory />
        </div>
      )}

      <div className="scroll-stack-layer scroll-stack-panel overflow-hidden bg-[var(--walnut)]">
        <RestrictedFeature />
      </div>

      <section className="scroll-stack-layer scroll-stack-panel section-space bg-[var(--cream)]">
        <div className="container-shell grid gap-12 lg:grid-cols-12 lg:items-center">
          <Reveal className="lg:col-span-5">
            <p className="eyebrow text-[var(--leather)]">Raíces familiares</p>
            <h2 className="display-lg mt-7">Paysandú es el punto de partida.</h2>
            <p className="mt-7 text-base leading-8 text-black/65">La historia comenzó con la familia Ortiz y La Unión Artesanías. Con los años llegó una nueva etapa, una nueva identidad y el nombre MateArte, sin perder el vínculo con el oficio regional.</p>
            <Link className="text-link mt-5" href="/nosotros">Leer la historia completa</Link>
          </Reveal>
          <Reveal className="lg:col-span-6 lg:col-start-7" delay={0.08}>
            <div className="relative aspect-[4/5] overflow-hidden"><Image src={editorialMedia.lifestyle.src} alt={editorialMedia.lifestyle.alt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" /></div>
          </Reveal>
        </div>
      </section>

      <section className="scroll-stack-layer scroll-stack-panel section-space bg-[var(--paper)]">
        <div className="container-shell">
          <SectionHeading eyebrow="Comunidad" title="El mate sale al mundo." body="Escaleras, rutas, mesas y encuentros: una selección del universo visual de MateArte." />
          <div className="mt-12 grid grid-cols-2 gap-2 md:grid-cols-12 md:grid-rows-2">
            {[editorialMedia.lifestyle, editorialMedia.hero, editorialMedia.tradition].map((image, index) => (
              <div key={image.src} className={`relative min-h-64 overflow-hidden ${index === 0 ? "md:col-span-5 md:row-span-2 md:min-h-[42rem]" : "md:col-span-7 md:min-h-[20.75rem]"}`}>
                <Image src={image.src} alt={image.alt} fill sizes="(max-width: 768px) 50vw, 60vw" className="object-cover" />
              </div>
            ))}
          </div>
          <p className="legal-note mt-6">Material público recopilado de los canales de la marca. Su publicación final requiere confirmar autorización y procedencia.</p>
        </div>
      </section>

      <section className="scroll-stack-layer scroll-stack-panel section-space bg-[var(--cream)]">
        <div className="container-shell grid gap-12 border-y border-black/20 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="eyebrow text-[var(--leather)]">Desde Paysandú</p>
            <h2 className="display-md mt-6">Envíos nacionales e internacionales.</h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-black/65">Destino, plazo y costo se confirmarán cuando el sistema comercial esté conectado. La web no mostrará promesas de entrega sin información real.</p>
          </div>
          <div className="md:border-l md:border-black/20 md:pl-12">
            <p className="eyebrow text-[var(--yerba)]">Visitanos</p>
            <h2 className="display-font mt-6 text-4xl md:text-5xl">25 de Mayo 1734</h2>
            <p className="mt-3 text-lg text-black/60">Paysandú, Uruguay</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="button-primary" href="/contacto">Datos de contacto</Link>
              <a className="button-secondary" href="https://www.google.com/maps/search/?api=1&query=25+de+Mayo+1734+Paysandu+Uruguay" target="_blank" rel="noreferrer">Abrir en Maps</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
