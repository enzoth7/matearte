export interface MateAssetEntry {
  src: string;
  alt: string;
  status: "ready";
}

const asset = (src: string, alt: string): MateAssetEntry => ({
  src: `/assets/mates/${src}`,
  alt,
  status: "ready",
});

export const mateAssetCatalog: Record<string, MateAssetEntry> = {
  "torpedo-clasico": asset("torpedo/cuero-liso/natural.webp", "Torpedo alpaca común"),
  "torpedo-cuero-crudo-grande-cincelada": asset("torpedo/cuero-crudo/cuero-crudo.webp", "Torpedo cuero crudo con alpaca grande"),
  "torpedo-cuero-liso-grande-lisa": asset("torpedo/cuero-liso/natural.webp", "Torpedo cuero liso con alpaca grande lisa"),
  "torpedo-croco-pelo-grande": asset("torpedo/print-pelos/animal-print.webp", "Torpedo pelos con alpaca grande"),
  "torpedo-croco-pelo": asset("torpedo/print-pelos/animal-print.webp", "Torpedo pelos con alpaca común"),
  "torpedo-cuero-liso-alpaca-grande": asset("torpedo/cuero-liso/natural.webp", "Torpedo cuero liso con alpaca grande"),
  "torpedo-alpaca-bronce-estampado": asset("torpedo/cuero-estampado/natural.webp", "Torpedo cuero estampado con alpaca y bronce"),
  "torpedo-croco-pelo-reforzado": asset("torpedo/print-pelos/animal-print.webp", "Torpedo pelos con alpaca y bronce"),
  "torpedo-cuero-liso-acero-bronce": asset("torpedo/cuero-liso/natural.webp", "Torpedo cuero liso con acero y bronce"),
  "torpedo-cuero-liso-alpaca-bronce": asset("torpedo/cuero-liso/natural.webp", "Torpedo cuero liso con alpaca y bronce"),
  "torpedo-cuero-liso-alpaca-cincelada": asset("torpedo/cuero-liso/natural.webp", "Torpedo cuero liso con alpaca común"),
  "torpedo-cuero-crudo-alpaca-bronce": asset("torpedo/cuero-crudo/cuero-crudo.webp", "Torpedo cuero crudo con alpaca y bronce"),
  "torpedo-cuero-crudo-alpaca-cincelada": asset("torpedo/cuero-crudo/cuero-crudo.webp", "Torpedo cuero crudo con alpaca común"),
  "torpedo-cuero-estampado-alpaca-comun": asset("torpedo/cuero-estampado/natural.webp", "Torpedo cuero estampado con alpaca común"),
  "torpedo-cuero-estampado-alpaca-grande": asset("torpedo/cuero-estampado/natural.webp", "Torpedo cuero estampado con alpaca grande"),
  "torpedo-cuero-croco": asset("torpedo/cuero-estampado/natural.webp", "Torpedo cuero estampado con alpaca lisa"),
  "torpedo-liso": asset("torpedo/cuero-liso/natural.webp", "Torpedo con virola lisa"),
  "criollo-clasico": asset("criollo/torpedo-criollo-posa-mate/natural.webp", "Criollo con posa mate natural"),
  "criollo-natural-posa-cinta": asset("criollo/torpedo-criollo-posa-mate/natural.webp", "Criollo natural con posa mate"),
  "criollo-natural-posa-copa": asset("criollo/torpedo-criollo-posa-mate/natural.webp", "Criollo natural con posa mate"),
  "criollo-oscuro-posa-copa": asset("criollo/torpedo-criollo-posa-mate/negro.webp", "Criollo con posa mate negro"),
  "criollo-grande-lisa-posa-cuero-crudo": asset("criollo/torpedo-criollo-posa-mate/cuero-crudo.webp", "Criollo alpaca grande lisa con posa mate de cuero crudo"),
  "criollo-grande-posa-cuero-crudo": asset("criollo/torpedo-criollo-posa-mate/cuero-crudo.webp", "Criollo alpaca grande con posa mate de cuero crudo"),
  "criollo-posa-cuero-crudo": asset("criollo/torpedo-criollo-posa-mate/cuero-crudo.webp", "Criollo con posa mate de cuero crudo"),
  "criollo-torpedo-posa-negro": asset("criollo/torpedo-criollo-posa-mate/negro.webp", "Torpedo criollo con posa mate negro"),
  "imperial-lacre": asset("imperial/cincelado-premium/natural.webp", "Imperial cincelado premium"),
  "imperial-criollo-posa-cuero-crudo": asset("criollo/imperial-criollo-posa-mate/cuero-crudo.webp", "Imperial criollo con posa mate de cuero crudo"),
  "imperial-criollo-posa-vaqueta": asset("criollo/imperial-criollo-posa-mate/natural.webp", "Imperial criollo con posa mate natural"),
  "imperial-criollo-posa-negro": asset("criollo/imperial-criollo-posa-mate/negro.webp", "Imperial criollo con posa mate negro"),
  "imperial-cuero-crudo": asset("imperial/cincelado-premium/cuero-crudo.webp", "Imperial cuero crudo"),
  "imperial-premium": asset("imperial/imperial-clasico/natural.webp", "Imperial clásico"),
  "imperial-print": asset("imperial/imperial-clasico/animal-print.webp", "Imperial animal print"),
  "imperial-clasico": asset("imperial/virola-plata-900/natural.webp", "Imperial con virola de plata 900"),
  "camionero-liso": asset("camionero/alpaca-comun-patas/natural.webp", "Camionero con alpaca común"),
  "camionero-artesanal": asset("camionero/alpaca-comun-patas/natural.webp", "Camionero con alpaca común"),
  "camionero-criollo-posa-vaqueta": asset("criollo/camionero-criollo-posa-mate/natural.webp", "Camionero criollo con posa mate natural"),
  "camionero-criollo-posa-cuero-crudo": asset("criollo/camionero-criollo-posa-mate/cuero-crudo.webp", "Camionero criollo con posa mate de cuero crudo"),
  "camionero-criollo-posa-negro": asset("criollo/camionero-criollo-posa-mate/negro.webp", "Camionero criollo con posa mate negro"),
  "estribo-imperial": asset("estribo/imperial.webp", "Imperial de la colección Estribo"),
  "estribo-torpedo": asset("estribo/torpedo.webp", "Torpedo de la colección Estribo"),
  "estribo-camionero": asset("estribo/camionero.webp", "Camionero de la colección Estribo"),
};

export function getMateAssetPath(variantId: string, fallback: string) {
  return mateAssetCatalog[variantId]?.src ?? fallback;
}
