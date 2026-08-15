"use client";

export function CartPanel() {
  return (
    <div className="border-y border-black/20 py-16 text-center">
      <p className="display-font text-4xl">Tu carrito está vacío.</p>
      <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-black/60">El carrito ya tiene su espacio reservado. Los productos podrán agregarse cuando el catálogo comercial y Mercado Pago estén conectados.</p>
    </div>
  );
}
