import Image from "next/image";
import { presentationMedia } from "@/data/catalog";

export function RestrictedFeature() {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_RESTRICTED_MEDIA === "true" || process.env.NEXT_PUBLIC_PRESENTATION_MODE !== "false";

  return (
    <section className="bg-[var(--walnut)] text-[var(--paper)]">
      <div className="container-shell grid min-h-[42rem] items-stretch lg:grid-cols-12">
        <div className="min-w-0 flex flex-col justify-center py-20 lg:col-span-5 lg:pr-16">
          <h2 className="display-lg mt-7">MateArte en manos de la Celeste.</h2>
          <div data-copy className="mt-7 max-w-xl text-base leading-8 text-[var(--paper)]/68">La marca comparte estas imágenes como parte de su historia reciente: piezas personalizadas que llegaron a futbolistas uruguayos y llevaron el oficio de Paysandú a nuevos escenarios.</div>
          <div data-copy className="mt-8 text-xs leading-6 text-[var(--paper)]/50">Presentación interna. Identidad, imagen personal, clubes y federaciones requieren validación de derechos antes de una publicación definitiva.</div>
        </div>
        <div className="relative min-h-[28rem] min-w-0 lg:col-span-7">
          {enabled ? (
            <div className="flex h-full max-w-full snap-x snap-mandatory gap-1 overflow-x-auto py-10 sm:grid sm:grid-cols-3 sm:overflow-visible">
              {presentationMedia.personalities.map((image, index) => (
                <div key={image.src} className={`group relative min-h-[32rem] w-[78vw] shrink-0 snap-center overflow-hidden transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_24px_55px_rgb(0_0_0_/_0.28)] motion-reduce:transform-none motion-reduce:transition-none sm:w-auto ${index === 1 ? "sm:mt-12 sm:mb-0" : "sm:mb-12"}`}>
                  <Image src={image.src} alt={image.alt} fill sizes="(max-width: 1024px) 33vw, 20vw" className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.055] motion-reduce:transform-none motion-reduce:transition-none" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/46 via-transparent to-transparent transition-opacity duration-300 group-hover:opacity-65 motion-reduce:transition-none" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[28rem] items-center justify-center border-x border-[var(--paper)]/15 bg-[linear-gradient(135deg,rgb(30 18 12 / .12),transparent_55%)] p-8 text-center">
              <div className="max-w-md">
                <div data-copy className="display-font text-5xl text-[var(--rawhide)]">UY</div>
                <div data-copy className="mt-5 text-sm font-semibold tracking-[0.18em] uppercase">Archivo reservado</div>
                <div data-copy className="mt-3 text-sm leading-6 text-[var(--paper)]/50">La composición está preparada para habilitar los recursos autorizados sin modificar el diseño.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
