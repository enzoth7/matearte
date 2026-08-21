import { describe, expect, it } from "vitest";
import { getDashboardSectionForDefinition, validatePricingValues } from "./pricingDashboardUtils";
import type { PricingRuleDefinition } from "../lib/pricingAdmin";

function definition(
  ruleKey: string,
  ruleType: PricingRuleDefinition["rule_type"],
  overrides: Partial<PricingRuleDefinition> = {},
): PricingRuleDefinition {
  return {
    rule_key: ruleKey,
    rule_type: ruleType,
    label: ruleKey,
    value_kind: "uyu",
    family_id: null,
    texture_id: null,
    color_id: null,
    metal_id: null,
    size_id: null,
    customization_id: null,
    required: true,
    active: true,
    sort_order: 0,
    ...overrides,
  };
}

describe("dashboard de precios", () => {
  it("asigna los errores a la familia correspondiente", () => {
    const family = definition("family:imperial", "family", { family_id: "imperial" });
    const customization = definition("customization:rim_text", "customization", { customization_id: "rim_text" });

    expect(getDashboardSectionForDefinition(family)).toBe("imperial");
    expect(getDashboardSectionForDefinition(customization)).toBe("extras");
  });

  it("detecta importes faltantes, porcentajes inválidos y combinaciones sin precio", () => {
    const definitions = [
      definition("texture:camionero:clasico", "texture", { family_id: "camionero", texture_id: "clasico" }),
      definition("metal:camionero:clasico:natural:alpaca", "metal", { family_id: "camionero", texture_id: "clasico", color_id: "natural", metal_id: "alpaca" }),
      definition("size:camionero:clasico:natural:alpaca:medio", "size", { family_id: "camionero", texture_id: "clasico", color_id: "natural", metal_id: "alpaca", size_id: "medio" }),
      definition("commission:mercado_pago", "commission", { value_kind: "percent" }),
    ];
    const issues = validatePricingValues(definitions, {
      "texture:camionero:clasico": "0",
      "metal:camionero:clasico:natural:alpaca": "0",
      "size:camionero:clasico:natural:alpaca:medio": "0",
      "commission:mercado_pago": "101",
    });

    expect(issues.some((issue) => issue.message.includes("100%"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("total mayor que cero"))).toBe(true);

    const missing = validatePricingValues(definitions, {});
    expect(missing).toHaveLength(definitions.length);
  });
});
