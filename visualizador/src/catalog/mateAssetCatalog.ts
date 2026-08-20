export interface MateAssetEntry {
  src: string;
  alt: string;
  status: "ready";
}

const asset = (family: string, id: string, alt: string): MateAssetEntry => ({
  src: `/assets/mates/${family}/${id}/preview.webp`,
  alt,
  status: "ready",
});

export const mateAssetCatalog: Record<string, MateAssetEntry> = {
  "torpedo-clasico": asset("torpedo", "torpedo-clasico", "Torpedo alpaca cincelado premium"),
  "torpedo-cuero-crudo-grande-cincelada": asset("torpedo", "torpedo-cuero-crudo-grande-cincelada", "Torpedo cuero crudo con virola grande cincelada"),
  "torpedo-cuero-liso-grande-lisa": asset("torpedo", "torpedo-cuero-liso-grande-lisa", "Torpedo cuero liso con alpaca grande lisa"),
  "torpedo-croco-pelo-grande": asset("torpedo", "torpedo-croco-pelo-grande", "Torpedo croco o pelos con alpaca grande"),
  "torpedo-croco-pelo": asset("torpedo", "torpedo-croco-pelo", "Torpedo croco o pelos con alpaca común"),
  "torpedo-cuero-liso-alpaca-grande": asset("torpedo", "torpedo-cuero-liso-alpaca-grande", "Torpedo cuero liso con alpaca grande"),
  "torpedo-alpaca-bronce-estampado": asset("torpedo", "torpedo-alpaca-bronce-estampado", "Torpedo cuero estampado con alpaca y bronce"),
  "torpedo-croco-pelo-reforzado": asset("torpedo", "torpedo-croco-pelo-reforzado", "Torpedo croco o pelos con alpaca y bronce"),
  "torpedo-cuero-liso-acero-bronce": asset("torpedo", "torpedo-cuero-liso-acero-bronce", "Torpedo cuero liso con acero y bronce"),
  "torpedo-cuero-liso-alpaca-bronce": asset("torpedo", "torpedo-cuero-liso-alpaca-bronce", "Torpedo cuero liso con alpaca y bronce"),
  "torpedo-cuero-liso-alpaca-cincelada": asset("torpedo", "torpedo-cuero-liso-alpaca-cincelada", "Torpedo cuero liso con alpaca cincelada"),
  "torpedo-cuero-crudo-alpaca-bronce": asset("torpedo", "torpedo-cuero-crudo-alpaca-bronce", "Torpedo cuero crudo con alpaca y bronce"),
  "torpedo-cuero-crudo-alpaca-cincelada": asset("torpedo", "torpedo-cuero-crudo-alpaca-cincelada", "Torpedo cuero crudo con alpaca cincelada"),
  "torpedo-cuero-estampado-alpaca-comun": asset("torpedo", "torpedo-cuero-estampado-alpaca-comun", "Torpedo cuero estampado con alpaca común"),
  "torpedo-cuero-estampado-alpaca-grande": asset("torpedo", "torpedo-cuero-estampado-alpaca-grande", "Torpedo cuero estampado con alpaca grande"),
  "torpedo-cuero-croco": asset("torpedo", "torpedo-cuero-croco", "Torpedo cuero estampado con alpaca lisa"),
  "torpedo-liso": asset("torpedo", "torpedo-liso", "Torpedo con virola de acero liso"),
  "criollo-clasico": asset("criollo", "criollo-clasico", "Criollo alpaca grande cincelada con posa mate de vaqueta"),
  "criollo-natural-posa-cinta": asset("criollo", "criollo-natural-posa-cinta", "Criollo natural con posa mate de cinta"),
  "criollo-natural-posa-copa": asset("criollo", "criollo-natural-posa-copa", "Criollo natural con posa mate copa"),
  "criollo-oscuro-posa-copa": asset("criollo", "criollo-oscuro-posa-copa", "Criollo oscuro con posa mate copa"),
  "criollo-grande-lisa-posa-cuero-crudo": asset("criollo", "criollo-grande-lisa-posa-cuero-crudo", "Criollo alpaca grande lisa con posa mate de cuero crudo"),
  "criollo-grande-posa-cuero-crudo": asset("criollo", "criollo-grande-posa-cuero-crudo", "Criollo alpaca grande cincelada con posa mate de cuero crudo"),
  "criollo-posa-cuero-crudo": asset("criollo", "criollo-posa-cuero-crudo", "Criollo con virola de acero y posa mate de cuero crudo"),
  "imperial-lacre": asset("imperial", "imperial-lacre", "Imperial cincelado premium"),
  "imperial-criollo-posa-cuero-crudo": asset("imperial", "imperial-criollo-posa-cuero-crudo", "Imperial criollo con posa mate de cuero crudo"),
  "imperial-cuero-crudo": asset("imperial", "imperial-cuero-crudo", "Imperial cuero crudo"),
  "imperial-premium": asset("imperial", "imperial-premium", "Imperial premium"),
  "imperial-print": asset("imperial", "imperial-print", "Imperial print"),
  "imperial-clasico": asset("imperial", "imperial-clasico", "Imperial con virola de plata 900"),
  "camionero-liso": asset("camionero", "camionero-liso", "Camionero con virola de acero liso"),
  "camionero-artesanal": asset("camionero", "camionero-artesanal", "Camionero con alpaca cincelada"),
  "camionero-criollo-posa-vaqueta": asset("camionero", "camionero-criollo-posa-vaqueta", "Camionero criollo con posa mate de vaqueta"),
};

export function getMateAssetPath(variantId: string, fallback: string) {
  return mateAssetCatalog[variantId]?.src ?? fallback;
}
