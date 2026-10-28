export const MATE_RIM_OPTIONS = [
  "Acero Liso",
  "Alpaca Grande Cincelada",
  "Alpaca y Bronce",
  "Alpaca Cincelada",
  "Imperial",
  "Alpaca",
  "Alpaca Común",
  "Alpaca Grande Lisa",
  "Acero",
] as const;

export const MATE_LEATHER_OPTIONS = [
  "Liso",
  "Crudo",
  "Estampado",
  "Croco",
  "Pelos",
  "Vaqueta",
] as const;

export const isMateCategory = (category: string) =>
  category === "mates" || category === "mates-personalizados";

const optionCode = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const mateRimCode = (value: string) => optionCode(value);
export const mateLeatherCode = (value: string) => optionCode(value);
