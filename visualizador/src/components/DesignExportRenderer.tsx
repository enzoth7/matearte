import { forwardRef, useImperativeHandle, useRef } from "react";
import { getDefaultVariant, getVariantDefinition } from "../catalog/mateCatalog";
import type { FlejeCustomization, MateConfiguration } from "../types/customizer";
import { ConfiguratorPreview } from "./ConfiguratorPreview";
import { FlatFlejePreview } from "./FlatFlejePreview";

export type DesignPreviewRole = "mate" | "virola" | "fleje_front" | "fleje_back";
export type DesignExportTargets = Partial<Record<DesignPreviewRole, HTMLElement>>;

export interface DesignExportRendererHandle {
  getTargets: () => DesignExportTargets;
}

interface DesignExportRendererProps {
  configuration: MateConfiguration;
  flejeConfig: FlejeCustomization;
}

const squareFrame = {
  width: 600,
  height: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  padding: 32,
  boxSizing: "border-box",
  background: "#fbf3de",
} as const;

const stripFrame = {
  width: 900,
  height: 300,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  padding: 24,
  boxSizing: "border-box",
  background: "#fbf3de",
} as const;

export const DesignExportRenderer = forwardRef<DesignExportRendererHandle, DesignExportRendererProps>(function DesignExportRenderer(
  { configuration, flejeConfig },
  ref,
) {
  const mateRef = useRef<HTMLDivElement>(null);
  const rimRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const variant = getVariantDefinition(configuration.variantId) ?? getDefaultVariant(configuration.modelId);
  const hasFleje = configuration.capabilities.hasFleje;

  useImperativeHandle(ref, () => ({
    getTargets: () => ({
      ...(mateRef.current ? { mate: mateRef.current } : {}),
      ...(rimRef.current ? { virola: rimRef.current } : {}),
      ...(hasFleje && frontRef.current ? { fleje_front: frontRef.current } : {}),
      ...(hasFleje && backRef.current ? { fleje_back: backRef.current } : {}),
    }),
  }), [hasFleje]);

  return (
    <div
      aria-hidden="true"
      style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none", width: 900, zIndex: -1 }}
    >
      <div ref={mateRef} style={squareFrame} data-design-preview-role="mate">
        <img
          src={variant.image}
          alt=""
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
      <div ref={rimRef} style={squareFrame} data-design-preview-role="virola">
        <ConfiguratorPreview
          rim={configuration.rim}
          model={configuration.modelId}
          engravingTypeId={configuration.engravingTypeId}
        />
      </div>
      {hasFleje && <>
        <div ref={frontRef} style={stripFrame} data-design-preview-role="fleje_front">
          <FlatFlejePreview flejeConfig={flejeConfig} activeSide="front" visibleSides={["front"]} showLabels={false} />
        </div>
        <div ref={backRef} style={stripFrame} data-design-preview-role="fleje_back">
          <FlatFlejePreview flejeConfig={flejeConfig} activeSide="back" visibleSides={["back"]} showLabels={false} />
        </div>
      </>}
    </div>
  );
});
