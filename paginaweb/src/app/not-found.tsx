import Link from "next/link";

export default function NotFound() {
  return (
    <main id="contenido" className="section-space min-h-[65svh]">
      <div className="container-shell text-center">
        <p className="eyebrow justify-center text-[var(--leather)]">404</p>
        <h1 className="display-lg mx-auto mt-7">Esta pieza no está en la colección.</h1>
        <p className="mt-6 text-black/60">Volvé al catálogo para seguir explorando.</p>
        <Link className="button-primary mt-8" href="/catalogo">Ir al catálogo</Link>
      </div>
    </main>
  );
}
