import { rimIconCatalog } from "../catalog/rimIconCatalog";
import { flejeFinishCatalog, type FlejeFinishId } from "../catalog/flejeFinishCatalog";

export interface FlejeCustomization {
  finishId: FlejeFinishId;
  textMode: "none" | "text";
  text: string;
  imageMode: "none" | "image";
  selectedImageId: string | null;
}

export function FlatFlejePreview({ flejeConfig }: { flejeConfig: FlejeCustomization }) {
  const flejeBaseAsset = "/assets/svg/fleje-base.svg";
  const flejeOutlineAsset = "/assets/svg/fleje-outline.svg";

  const { finishId, textMode, text, imageMode, selectedImageId } = flejeConfig;
  
  const selectedFinish = flejeFinishCatalog.find(f => f.id === finishId);
  
  const hasText = textMode === "text" && Boolean(text.trim());
  const hasIcon = imageMode === "image" && Boolean(selectedImageId);
  const icon = hasIcon ? rimIconCatalog.find(i => i.id === selectedImageId) : null;

  const maxTextWidth = hasText && icon ? 480 : 760;
  const fontSize = Math.max(55, Math.min(110, 160 - text.length * 4.5));
  const strokeWidth = fontSize * 0.65;
  const letterSpacing = text.length > 12 ? 4 : (text.length > 8 ? 6 : 10);
  
  let textX = 627;
  let textY = 630;
  let iconX = 627;
  const iconY = 627;
  const iconSize = 160;
  const iconHalf = iconSize / 2;

  if (hasText && icon) {
    iconX = 420;
    textX = 780;
  }

  return (
    <div className="relative aspect-square w-full max-w-[540px] overflow-hidden" aria-label="Vista editable del fleje plano">
      <svg viewBox="0 0 1254 1254" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {/* Layer 1: Base */}
        <image
          href={flejeBaseAsset}
          x="0"
          y="0"
          width="1254"
          height="1254"
          preserveAspectRatio="xMidYMid meet"
        />

        <defs>
          <filter id="white-to-transparent" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="
              0 0 0 0 0
              0 0 0 0 0
              0 0 0 0 0
              -1 0 0 0 1
            " />
          </filter>
        </defs>

        {/* Mask for text knockout */}
        {(hasText || icon) && (
          <defs>
            <mask id="fleje-text-mask" mask-type="luminance" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
              <rect width="1254" height="1254" fill="white" />
              {hasText && (
                <text
                  x={textX}
                  y={textY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="black"
                  stroke="black"
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  paintOrder="stroke fill"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  fontSize={fontSize}
                  fontWeight="700"
                  letterSpacing={letterSpacing}
                  textLength={text.length > 10 ? maxTextWidth : undefined}
                  lengthAdjust={text.length > 10 ? "spacingAndGlyphs" : undefined}
                >
                  {text}
                </text>
              )}
              {icon && (
                <circle cx={iconX} cy={iconY} r={95} fill="black" />
              )}
            </mask>
          </defs>
        )}

        {/* Layer 2: Decor pattern with text/icon mask applied */}
        {selectedFinish?.src && (
          <g mask={(hasText || icon) ? "url(#fleje-text-mask)" : undefined}>
            <image
              href={selectedFinish.src}
              x="0"
              y="0"
              width="1254"
              height="1254"
              preserveAspectRatio="xMidYMid meet"
              filter="url(#white-to-transparent)"
            />
          </g>
        )}

        {/* Layer 3: Icon */}
        {icon && (
          <g>
            <circle cx={iconX} cy={iconY} r={95} fill="#D9D9D9" />
            <image
              href={icon.src}
              x={iconX - iconHalf}
              y={iconY - iconHalf}
              width={iconSize}
              height={iconSize}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        )}

        {/* Layer 4: The actual text */}
        {hasText && (
          <text
            x={textX}
            y={textY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#1f1f1f"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize={fontSize}
            fontWeight="700"
            letterSpacing={letterSpacing}
            textLength={text.length > 10 ? maxTextWidth : undefined}
            lengthAdjust={text.length > 10 ? "spacingAndGlyphs" : undefined}
          >
            {text}
          </text>
        )}

        {/* Layer 5: Outline */}
        <image
          href={flejeOutlineAsset}
          x="0"
          y="0"
          width="1254"
          height="1254"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
    </div>
  );
}
