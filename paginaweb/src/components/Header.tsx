"use client";

import { Globe, List, MagnifyingGlass, ShoppingCart, UserCircle, X } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { es } from "@/content/es";

export function Header() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<{ authenticated: boolean; user: { name: string } | null; cartCount: number }>({ authenticated: false, user: null, cartCount: 0 });
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { signal: controller.signal, credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => value && setSession(value))
      .catch(() => undefined);
    return () => controller.abort();
  }, [pathname]);

  const globalLogout = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    const value = await response.json();
    window.location.assign(value.continueAt || '/');
  };

  return (
    <>
      <div className="bg-[var(--walnut)] px-4 py-2 text-center text-[0.72rem] font-medium tracking-[0.14em] text-[var(--paper)] uppercase">
        Nacido en Paysandú · Envíos nacionales e internacionales
      </div>
      <header className="sticky top-0 z-50 border-b border-black/10 bg-[color:rgb(245_239_227_/_0.94)] backdrop-blur-md">
        <div className="container-shell flex h-20 items-center justify-between gap-6">
          <Link className="flex min-h-11 items-center gap-3" href="/" aria-label="MateArte Uruguay, inicio">
            <Image
              src="/assets/matearte/01-marca/LogoOriginal.jpg"
              alt={"MateArte Arte & Tradici\u00f3n"}
              width={240}
              height={240}
              className="h-12 w-12 object-contain"
              priority
            />
            <span className="hidden flex-col sm:flex" aria-hidden="true">
              <strong className="display-font text-xl leading-none text-[var(--walnut)]">MateArte</strong>
              <span className="mt-1 text-[0.58rem] font-semibold tracking-[0.16em] text-black/55 uppercase">{"Arte & Tradici\u00f3n"}</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegación principal">
            {es.navigation.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-11 items-center border-b text-sm font-medium transition-colors ${active ? "border-[var(--leather)] text-[var(--leather)]" : "border-transparent hover:text-[var(--leather)]"}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex min-h-11 min-w-11 cursor-default items-center justify-center gap-1.5 px-1 text-black/60"
              aria-label="Selector de idioma próximamente. Idioma actual: Español"
              title="Idiomas próximamente"
              disabled
            >
              <Globe size={20} aria-hidden="true" />
              <span className="text-[0.68rem] font-semibold tracking-[0.08em]" aria-hidden="true">ES</span>
            </button>
            <Link href="/catalogo" className="flex size-11 items-center justify-center" aria-label="Buscar en el catálogo">
              <MagnifyingGlass size={21} aria-hidden="true" />
            </Link>
            {session.authenticated ? (
              <Link href="/perfil" className="hidden min-h-11 items-center gap-2 px-2 text-sm font-medium text-[var(--walnut)] sm:flex" aria-label="Abrir mi cuenta y mis pedidos">
                <UserCircle size={21} aria-hidden="true" /><span className="max-w-24 truncate">{session.user?.name}</span>
              </Link>
            ) : (
              <Link href="/perfil" className="hidden min-h-11 items-center px-2 text-sm font-medium text-[var(--walnut)] sm:flex">Ingresar</Link>
            )}
            {session.authenticated && <button type="button" onClick={() => void globalLogout()} className="hidden min-h-11 px-2 text-xs text-black/60 xl:block">Salir</button>}
            <Link
              href="/carrito"
              className="relative flex size-11 items-center justify-center"
              aria-label={`Carrito${session.cartCount ? `, ${session.cartCount} artículos` : ""}`}
            >
              <ShoppingCart size={21} aria-hidden="true" />
              {session.cartCount > 0 && <span className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-[var(--leather)] text-[0.65rem] font-bold text-white">{Math.min(99, session.cartCount)}</span>}
            </Link>
            <button
              type="button"
              className="flex size-11 items-center justify-center lg:hidden"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={open}
              aria-controls="menu-movil"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X size={24} aria-hidden="true" /> : <List size={24} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>
      {open && (
        <div id="menu-movil" className="fixed inset-x-0 bottom-0 top-[7rem] z-40 bg-[var(--cream)] p-5 lg:hidden">
          <nav className="container-shell flex flex-col border-t border-black/15" aria-label="Navegación móvil">
            {es.navigation.map((item, index) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="display-font flex min-h-20 items-center justify-between border-b border-black/15 text-3xl">
                {item.label}<span className="font-sans text-xs tracking-widest">0{index + 1}</span>
              </Link>
            ))}
            {session.authenticated && (
              <Link href="/perfil" onClick={() => setOpen(false)} className="display-font flex min-h-20 items-center justify-between border-b border-black/15 text-3xl">
                Mi cuenta <UserCircle size={26} aria-hidden="true" />
              </Link>
            )}
            {!session.authenticated && (
              <Link href="/perfil" onClick={() => setOpen(false)} className="display-font flex min-h-20 items-center justify-between border-b border-black/15 text-3xl">
                Ingresar <UserCircle size={26} aria-hidden="true" />
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
