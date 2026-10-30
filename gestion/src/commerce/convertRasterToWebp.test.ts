import { afterEach, describe, expect, it, vi } from "vitest";
import { convertRasterToWebp } from "./convertRasterToWebp";

describe("convertRasterToWebp", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("convierte un PNG antes de cargarlo y conserva sus dimensiones", async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["webp"], { type: "image/webp" })),
    };
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 720, height: 720, close })));
    vi.stubGlobal("document", { createElement: () => canvas });

    const result = await convertRasterToWebp(new File(["png"], "mate.png", { type: "image/png" }), 0.88, 100);

    expect(result.name).toBe("mate.webp");
    expect(result.type).toBe("image/webp");
    expect(canvas.width).toBe(720);
    expect(canvas.height).toBe(720);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
