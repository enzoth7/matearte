import Link from "next/link";
import { es } from "@/content/es";

export function Footer() {
  return (
    <footer className="bg-[var(--ink)] text-[var(--paper)]">
      <div className="container-shell grid gap-14 py-16 md:grid-cols-12 md:py-24">
        <div className="md:col-span-5">
          <p className="eyebrow text-[var(--rawhide)]">MateArte Uruguay</p>
          <p className="display-font mt-6 max-w-md text-4xl leading-tight md:text-5xl">Cada mate tiene su historia.</p>
          <p className="mt-6 max-w-md text-sm leading-7 text-white/65">Arte, tradición y oficio familiar desde Paysandú. Piezas para acompañar el ritual cotidiano.</p>
        </div>
        <div className="grid gap-10 sm:grid-cols-2 md:col-span-7 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/45">Explorar</p>
            <div className="mt-5 flex flex-col gap-2">
              {es.navigation.map((item) => <Link key={item.href} className="text-link" href={item.href}>{item.label}</Link>)}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/45">Categorías</p>
            <div className="mt-5 flex flex-col gap-2">
              {["mates", "bombillas", "materas", "termos", "regalos"].map((slug) => <Link key={slug} className="text-link capitalize" href={`/catalogo/${slug}`}>{slug}</Link>)}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/45">Contacto</p>
            <div className="mt-5 flex flex-col gap-2 text-sm">
              <a className="text-link" href={`tel:${es.contact.phoneHref}`}>{es.contact.phoneDisplay}</a>
              <a className="text-link break-all" href={`mailto:${es.contact.email}`}>{es.contact.email}</a>
              <a className="text-link" href={es.contact.instagramUrl} target="_blank" rel="noreferrer">{es.contact.instagram}</a>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-shell flex flex-col gap-3 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MateArte Uruguay.</p>
          <p>25 de Mayo 1734 · Paysandú, Uruguay</p>
        </div>
      </div>
    </footer>
  );
}
