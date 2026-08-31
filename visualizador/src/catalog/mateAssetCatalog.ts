export interface MateAssetEntry {
  src: string;
  alt: string;
  status: "ready";
}

const asset = (src: string, alt: string): MateAssetEntry => ({
  src: `/assets2/mates/${src}`,
  alt,
  status: "ready",
});

export const mateAssetCatalog: Record<string, MateAssetEntry> = {
  "torpedo-clasico": asset("torpedo/cuero-liso/natural.png", "Torpedo alpaca común"),
  "torpedo-cuero-crudo-grande-cincelada": asset("torpedo/cuero-crudo/cuero-crudo.png", "Torpedo cuero crudo con alpaca grande"),
  "torpedo-cuero-liso-grande-lisa": asset("torpedo/cuero-liso/natural.png", "Torpedo cuero liso con alpaca grande lisa"),
  "torpedo-croco-pelo-grande": asset("torpedo/print-pelos/animal-print.png", "Torpedo pelos con alpaca grande"),
  "torpedo-croco-pelo": asset("torpedo/print-pelos/animal-print.png", "Torpedo pelos con alpaca común"),
  "torpedo-cuero-liso-alpaca-grande": asset("torpedo/cuero-liso/natural.png", "Torpedo cuero liso con alpaca grande"),
  "torpedo-alpaca-bronce-estampado": asset("torpedo/cuero-estampado/natural.png", "Torpedo cuero estampado con alpaca y bronce"),
  "torpedo-croco-pelo-reforzado": asset("torpedo/print-pelos/animal-print.png", "Torpedo pelos con alpaca y bronce"),
  "torpedo-cuero-liso-acero-bronce": asset("torpedo/cuero-liso/natural.png", "Torpedo cuero liso con acero y bronce"),
  "torpedo-cuero-liso-alpaca-bronce": asset("torpedo/cuero-liso/natural.png", "Torpedo cuero liso con alpaca y bronce"),
  "torpedo-cuero-liso-alpaca-cincelada": asset("torpedo/cuero-liso/natural.png", "Torpedo cuero liso con alpaca común"),
  "torpedo-cuero-crudo-alpaca-bronce": asset("torpedo/cuero-crudo/cuero-crudo.png", "Torpedo cuero crudo con alpaca y bronce"),
  "torpedo-cuero-crudo-alpaca-cincelada": asset("torpedo/cuero-crudo/cuero-crudo.png", "Torpedo cuero crudo con alpaca común"),
  "torpedo-cuero-estampado-alpaca-comun": asset("torpedo/cuero-estampado/natural.png", "Torpedo cuero estampado con alpaca común"),
  "torpedo-cuero-estampado-alpaca-grande": asset("torpedo/cuero-estampado/natural.png", "Torpedo cuero estampado con alpaca grande"),
  "torpedo-cuero-croco": asset("torpedo/cuero-estampado/natural.png", "Torpedo cuero estampado con alpaca lisa"),
  "torpedo-liso": asset("torpedo/cuero-liso/natural.png", "Torpedo con virola lisa"),
  "criollo-clasico": asset("criollo/torpedo-criollo-posa-mate/vaqueta.jpg", "Criollo con posa mate de vaqueta"),
  "criollo-natural-posa-cinta": asset("criollo/torpedo-criollo-posa-mate/vaqueta.jpg", "Criollo natural con posa mate de cinta"),
  "criollo-natural-posa-copa": asset("criollo/torpedo-criollo-posa-mate/vaqueta.jpg", "Criollo natural con posa mate copa"),
  "criollo-oscuro-posa-copa": asset("criollo/torpedo-criollo-posa-mate/vaqueta.jpg", "Criollo oscuro con posa mate copa"),
  "criollo-grande-lisa-posa-cuero-crudo": asset("criollo/torpedo-criollo-posa-mate/cuero-crudo.jpg", "Criollo alpaca grande lisa con posa mate de cuero crudo"),
  "criollo-grande-posa-cuero-crudo": asset("criollo/torpedo-criollo-posa-mate/cuero-crudo.jpg", "Criollo alpaca grande con posa mate de cuero crudo"),
  "criollo-posa-cuero-crudo": asset("criollo/torpedo-criollo-posa-mate/cuero-crudo.jpg", "Criollo con posa mate de cuero crudo"),
  "imperial-lacre": asset("imperial/cincelado-premium/natural.png", "Imperial cincelado premium"),
  "imperial-criollo-posa-cuero-crudo": asset("criollo/imperial-criollo-posa-mate/cuero-crudo.jpg", "Imperial criollo con posa mate de cuero crudo"),
  "imperial-cuero-crudo": asset("imperial/cincelado-premium/cuero-crudo.png", "Imperial cuero crudo"),
  "imperial-premium": asset("imperial/imperial-clasico/natural.png", "Imperial clásico"),
  "imperial-print": asset("imperial/imperial-clasico/animal-print.jpg", "Imperial animal print"),
  "imperial-clasico": asset("imperial/virola-plata-900/natural.png", "Imperial con virola de plata 900"),
  "camionero-liso": asset("camionero/alpaca-comun-patas/natural.png", "Camionero con alpaca común"),
  "camionero-artesanal": asset("camionero/alpaca-comun-patas/natural.png", "Camionero con alpaca común"),
  "camionero-criollo-posa-vaqueta": asset("criollo/camionero-criollo-posa-mate/vaqueta.jpg", "Camionero criollo con posa mate de vaqueta"),
};

export function getMateAssetPath(variantId: string, fallback: string) {
  return mateAssetCatalog[variantId]?.src ?? fallback;
}
