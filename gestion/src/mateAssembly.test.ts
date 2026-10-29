import { describe, expect, it } from "vitest";
import { assemblyFieldsFor, mateAssemblyFields, mateAssemblyRuleKeys, priceMateAssembly, validateMateAssemblyCore } from "../../shared/mate-assembly";
import { mateAssemblyPresentation } from "./mateAssemblyPresentation";
import { buildLocalPersonalizationSnapshot, createPersonalizationDraft, validatePersonalization } from "./localPersonalization";
const assembly = { "tipo-mate": "imperial", interior: "ceramica", "tipo-cuero": "croco", color: "mostaza-chocolate", "tipo-virola": "alpaca-y-bronce", "diseno-fleje": "laureles", posamate: "con-posamate", pie: "alpaca", tamano: "grande" };
export const assemblyTestRules = Object.fromEntries(mateAssemblyFields.flatMap(f => f.options.map(o => [o.ruleKey, o.initialPrice])));
describe("mate por piezas sin SKU", () => {
  it("solo exige modelo, forma del criollo y cuero para agregar al borrador", () => {
    expect(validateMateAssemblyCore({})).toBe("Modelo");
    expect(validateMateAssemblyCore({ "tipo-mate": "criollo" })).toBe("Forma del criollo");
    expect(validateMateAssemblyCore({ "tipo-mate": "criollo", "forma-criollo": "torpedo" })).toBe("Cuero o textura");
    expect(validateMateAssemblyCore({ "tipo-mate": "criollo", "forma-criollo": "torpedo", "tipo-cuero": "liso" })).toBeUndefined();
    expect(validateMateAssemblyCore({ "tipo-mate": "imperial", "tipo-cuero": "liso" })).toBeUndefined();
    const quickMate = { "tipo-mate": "criollo", "forma-criollo": "torpedo", "tipo-cuero": "liso" };
    expect(priceMateAssembly({ ...quickMate, "tipo-cuero": "croco" }, assemblyTestRules).totalMinor
      - priceMateAssembly(quickMate, assemblyTestRules).totalMinor).toBe(60000);
  });
  it("ofrece todas las piezas independientemente de las otras elecciones", () => {
    const fields = assemblyFieldsFor(assembly);
    expect(fields.find(f => f.code === "tipo-cuero")!.options.map(o => o.value)).toEqual(expect.arrayContaining(["croco", "crudo", "pelos", "vaqueta", "sin-cuero"]));
    expect(fields.find(f => f.code === "color")!.options.length).toBeGreaterThan(25);
    expect(fields.find(f => f.code === "tipo-virola")!.options.length).toBeGreaterThan(15);
    expect(fields.find(f => f.code === "pie")!.options).toHaveLength(3);
    expect(priceMateAssembly(assembly, assemblyTestRules)).toMatchObject({ ready: true, totalMinor: 450000 });
    expect(mateAssemblyRuleKeys(assembly).some(key => key.startsWith("assembly:color:"))).toBe(false);
    const withoutColorTariffs = Object.fromEntries(Object.entries(assemblyTestRules).filter(([key]) => !key.startsWith("assembly:color:")));
    expect(priceMateAssembly({ ...assembly, color: "negro" }, withoutColorTariffs)).toMatchObject({ ready: true, totalMinor: 450000 });
    expect(priceMateAssembly(assembly, { ...withoutColorTariffs, "assembly:color:mostaza-chocolate": 900 }).totalMinor).toBe(450000);
  });
  it("no duplica posamate y distingue cero publicado de tarifa ausente", () => {
    expect(mateAssemblyRuleKeys({ ...assembly, "tipo-cuero": "crudo" })).toContain("leather:raw-posa-mate");
    expect(mateAssemblyRuleKeys({ ...assembly, "tipo-cuero": "crudo" })).not.toContain("assembly:posamate:con-posamate");
    const criollo = { ...assembly, "tipo-mate": "criollo", "forma-criollo": "imperial" };
    expect(mateAssemblyRuleKeys(criollo)).not.toContain("assembly:posamate:con-posamate");
    const rules = { ...assemblyTestRules }; delete rules['assembly:pie:alpaca'];
    expect(priceMateAssembly(assembly, rules).ready).toBe(false);
  });
  it("conserva armado, texto y precio histórico al cambiar las tarifas", () => {
    const presentation = mateAssemblyPresentation(assembly, assemblyTestRules);
    const draft = createPersonalizationDraft("mate", presentation); draft.rimText = "ENZO";
    expect(presentation.id).toBe(""); expect(presentation.sku).toBe("");
    expect(validatePersonalization(draft, presentation)).toBe("");
    const snapshot = buildLocalPersonalizationSnapshot(draft, presentation) as any;
    expect(snapshot.assembly.selections).toEqual(assembly);
    expect(snapshot.configuration.selectedOptions).toEqual({ tamano: "grande", interior: "ceramica" });
    const before = presentation.prices.Local;
    expect(priceMateAssembly(assembly, { ...assemblyTestRules, "family:imperial": 3000 }).totalMinor).toBe(490000);
    expect(presentation.prices.Local).toBe(before);
  });
  it("permite un armado sin virola y sin grabado", () => {
    const p = mateAssemblyPresentation({ ...assembly, "tipo-virola": "sin-virola", "diseno-fleje": "sin-fleje" }, assemblyTestRules);
    const draft = createPersonalizationDraft("mate", p);
    expect(draft.rimTechnique).toBe("none");
    expect(validatePersonalization(draft, p)).toBe("");
    expect((buildLocalPersonalizationSnapshot(draft, p) as any).configuration.capabilities).toEqual({ hasRim: false, hasFleje: false });
  });
});
