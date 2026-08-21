import type { PricingRuleDefinition } from "../lib/pricingAdmin";

export type EditablePricingValues = Record<string, string>;
export type PricingDashboardSection = "camionero" | "imperial" | "torpedo" | "criollo" | "extras";

export const PRICING_FAMILY_LABELS: Record<string, string> = {
  camionero: "Camionero",
  imperial: "Imperial",
  torpedo: "Torpedo",
  criollo: "Criollo",
};

export function getNumericPricingValues(values: EditablePricingValues) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => {
    const normalized = value.trim().replace(",", ".");
    return [key, normalized === "" ? null : Number(normalized)];
  }));
}

export function validatePricingValues(definitions: PricingRuleDefinition[], values: EditablePricingValues) {
  const parsed = getNumericPricingValues(values);
  const issues: Array<{ key: string; message: string }> = [];

  definitions.forEach((definition) => {
    const value = parsed[definition.rule_key];
    if (definition.required && value === null) {
      issues.push({ key: definition.rule_key, message: `Falta ${definition.label}` });
    } else if (value !== null && (!Number.isFinite(value) || value < 0)) {
      issues.push({ key: definition.rule_key, message: `${definition.label} tiene un valor inválido` });
    } else if (value !== null && definition.value_kind === "percent" && value > 100) {
      issues.push({ key: definition.rule_key, message: `${definition.label} no puede superar 100%` });
    }
  });

  definitions.filter((definition) => definition.rule_type === "size").forEach((size) => {
    const texture = parsed[`texture:${size.family_id}:${size.texture_id}`];
    const metal = parsed[`metal:${size.family_id}:${size.texture_id}:${size.color_id}:${size.metal_id}`] ?? 0;
    const sizeValue = parsed[size.rule_key];
    if (
      [texture, metal, sizeValue].every((value) => typeof value === "number" && Number.isFinite(value)) &&
      Number(texture) + Number(metal) + Number(sizeValue) <= 0
    ) {
      issues.push({ key: size.rule_key, message: `La combinación ${size.label} debe tener un total mayor que cero` });
    }
  });

  return issues;
}

export function getDashboardSectionForDefinition(definition: PricingRuleDefinition): PricingDashboardSection {
  if (definition.family_id && definition.family_id in PRICING_FAMILY_LABELS) {
    return definition.family_id as PricingDashboardSection;
  }
  return "extras";
}
