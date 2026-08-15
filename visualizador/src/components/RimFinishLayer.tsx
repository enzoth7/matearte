import { useId, useState } from "react";
import type { RimFinish } from "../catalog/rimFinishCatalog";
import { RIM_VIEWBOX_SIZE, rimTextGeometry, type RimTextGeometry } from "../catalog/rimGeometry";
import type { ElementTransform } from "../types/customizer";
import { RimTextFinishMask } from "./CircularRimText";

interface RimFinishLayerProps {
  finish: RimFinish | undefined;
  hasTextKnockout: boolean;
  text: string;
  textGeometry?: RimTextGeometry;
  textTransform?: ElementTransform;
}

export function RimFinishLayer({ finish, hasTextKnockout, text, textGeometry = rimTextGeometry, textTransform }: RimFinishLayerProps) {
  const [failedFinishId, setFailedFinishId] = useState<string | null>(null);
  const finishMaskId = `rim-text-cutout-${useId().replace(/:/g, "")}`;

  if (!finish || failedFinishId === finish.id) return null;

  const width = finish.width ?? RIM_VIEWBOX_SIZE;
  const height = finish.height ?? RIM_VIEWBOX_SIZE;
  const x = RIM_VIEWBOX_SIZE / 2 - width / 2;
  const y = RIM_VIEWBOX_SIZE / 2 - height / 2;

  return (
    <>
      {hasTextKnockout && (
        <defs>
          <RimTextFinishMask id={finishMaskId} text={text} geometry={textGeometry} transform={textTransform} />
        </defs>
      )}
      <g mask={hasTextKnockout ? `url(#${finishMaskId})` : undefined}>
        <image
          href={finish.image}
          x={x}
          y={y}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid meet"
          onLoad={() => setFailedFinishId(null)}
          onError={() => setFailedFinishId(finish.id)}
        />
      </g>
    </>
  );
}
