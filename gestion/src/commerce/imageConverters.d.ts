declare module "imagetracerjs" {
  const tracer: {
    imagedataToSVG(image: ImageData, options: Record<string, unknown>): string;
  };
  export default tracer;
}

declare module "utif" {
  type Page = { width: number; height: number; t256?: number[]; t257?: number[] };
  const UTIF: {
    decode(buffer: ArrayBuffer): Page[];
    decodeImage(buffer: ArrayBuffer, page: Page): void;
    toRGBA8(page: Page): Uint8Array;
    encodeImage(rgba: ArrayBuffer, width: number, height: number): ArrayBuffer;
  };
  export default UTIF;
}
