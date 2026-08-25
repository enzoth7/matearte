import { RIM_VIEWBOX_SIZE } from "../catalog/rimGeometry";

const rimBaseAsset = "/assets/plantillas/virola/base.svg";
const rimCenterAsset = "/assets/plantillas/virola/centro.svg";

export function RimBaseLayer() {
  return (
    <>
      <image
        href={rimBaseAsset}
        x="0"
        y="0"
        width={RIM_VIEWBOX_SIZE}
        height={RIM_VIEWBOX_SIZE}
        preserveAspectRatio="xMidYMid meet"
      />
      <image
        href={rimCenterAsset}
        x="0"
        y="0"
        width={RIM_VIEWBOX_SIZE}
        height={RIM_VIEWBOX_SIZE}
        preserveAspectRatio="xMidYMid meet"
      />
    </>
  );
}
