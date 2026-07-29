import { getRimFinish } from "../catalog/rimFinishCatalog";
import type { RimCustomization } from "../catalog/rimCatalog";
import { CircularRimText } from "./CircularRimText";
import { RimFinishLayer } from "./RimFinishLayer";
import { RimIconLayer } from "./RimIconLayer";

import { RIM_VIEWBOX_SIZE } from "../catalog/rimGeometry";

interface ConfiguratorPreviewProps { rim: RimCustomization }

export function ConfiguratorPreview({ rim }: ConfiguratorPreviewProps) {
  const finish = rim.finishMode === "finish" ? getRimFinish(rim.finishId) : undefined;
  const hasTextKnockout = rim.textMode === "text" && Boolean(rim.text.trim());
  const outlineAsset = "/assets/svg/rim-outline.svg";
  const baseAsset = "/assets/svg/rim-base.svg";
  const centerAsset = "/assets/svg/rim-center.svg";

  return (
    <div className="relative aspect-square w-full max-w-[540px] overflow-hidden" aria-label="Vista editable de la virola">
      <svg
        viewBox={`0 0 ${RIM_VIEWBOX_SIZE} ${RIM_VIEWBOX_SIZE}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* Layer 1: Base */}
        <image
          href={baseAsset}
          x="0"
          y="0"
          width={RIM_VIEWBOX_SIZE}
          height={RIM_VIEWBOX_SIZE}
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Layer 2: Decor finish */}
        <RimFinishLayer finish={finish} hasTextKnockout={hasTextKnockout} text={rim.text} />
        
        {/* Layer 3: Circular text with knockout */}
        {rim.textMode === "text" && <CircularRimText text={rim.text} />}
        
        {/* Layer 4: Icons */}
        {rim.imageMode === "image" && <RimIconLayer selectedImageId={rim.selectedImageId} />}
        
        {/* Layer 5: Outline */}
        <image
          href={outlineAsset}
          x="0"
          y="0"
          width={RIM_VIEWBOX_SIZE}
          height={RIM_VIEWBOX_SIZE}
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Layer 6: Center */}
        <image
          href={centerAsset}
          x="0"
          y="0"
          width={RIM_VIEWBOX_SIZE}
          height={RIM_VIEWBOX_SIZE}
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
    </div>
  );
}
