import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getRimGeometryProfile } from "../catalog/rimGeometry";
import { rimIconCatalog } from "../catalog/rimIconCatalog";
import { createDefaultFlejeCustomization, type ElementTransform } from "../types/personalizer";
import { FlatFlejePreview } from "../components/FlatFlejePreview";
import { RimIconLayer } from "../components/RimIconLayer";
import { rotationFromPointer } from "./iconRotation";

const transform: ElementTransform = { x: 0.5, y: 0.5, scale: 1, rotation: 35, side: "rim" };

describe("giro de íconos", () => {
  it("sigue el puntero y cruza el límite de 180 grados sin saltar", () => {
    expect(rotationFromPointer(0, -135, -45)).toBe(90);
    expect(rotationFromPointer(170, 170, -170)).toBe(-170);
    expect(rotationFromPointer(-170, -170, 170)).toBe(170);
  });

  it("muestra el control blanco y aplica el ángulo en la virola", () => {
    const props = {
      selectedImageId: rimIconCatalog[0].id,
      profile: getRimGeometryProfile("imperial"),
      transform,
      onRotateDown: () => {},
    };
    const selected = renderToStaticMarkup(<svg><RimIconLayer {...props} selected /></svg>);
    const unselected = renderToStaticMarkup(<svg><RimIconLayer {...props} /></svg>);
    expect(selected).toContain('aria-label="Girar ícono"');
    expect(selected).toContain('transform="rotate(35 ');
    expect(selected).toContain('fill="#fff"');
    expect(unselected).not.toContain('aria-label="Girar ícono"');
  });

  it("muestra el control solo para el ícono seleccionado del fleje", () => {
    const flejeConfig = createDefaultFlejeCustomization();
    flejeConfig.sides.front.imageMode = "image";
    flejeConfig.sides.front.icons = [{
      id: "icon-1",
      selectedImageId: rimIconCatalog[0].id,
      customImage: null,
      transform: { ...transform, side: "front" },
    }];
    const selected = renderToStaticMarkup(
      <FlatFlejePreview flejeConfig={flejeConfig} visibleSides={["front"]} editable selectedElement="icon-1" onTransformChange={() => {}} />,
    );
    const unselected = renderToStaticMarkup(
      <FlatFlejePreview flejeConfig={flejeConfig} visibleSides={["front"]} editable onTransformChange={() => {}} />,
    );
    expect(selected).toContain('aria-label="Girar ícono"');
    expect(selected).toContain('rotate(35)');
    expect(selected).toContain('fill="#fff"');
    expect(unselected).not.toContain('aria-label="Girar ícono"');
  });
});
