import { describe, expect, it } from "vitest";
import { serializeDesignConfiguration } from "./supabase";

describe("serializeDesignConfiguration", () => {
  it("no guarda base64 cuando el original ya está en Supabase", () => {
    const value = serializeDesignConfiguration({
      rim: {
        icons: [{
          customImage: {
            source: "upload",
            previewUrl: "data:image/png;base64,very-large-value",
            originalUrl: "storage:design-assets/user/design/logo.png",
            storageRef: "storage:design-assets:user/design/logo.png",
          },
        }],
      },
    });

    const image = value.rim.icons[0].customImage;
    expect(image.previewUrl).toBe("storage:design-assets:user/design/logo.png");
    expect(JSON.stringify(value)).not.toContain("base64");
  });

  it("conserva la referencia local sin guardar su vista base64 antes de sincronizar", () => {
    const value = serializeDesignConfiguration({
      customImage: {
        source: "upload",
        previewUrl: "data:image/jpeg;base64,temporary",
        originalUrl: "indexeddb:upload-123",
      },
    });

    expect(value.customImage.previewUrl).toBe("indexeddb:upload-123");
    expect(JSON.stringify(value)).not.toContain("base64");
  });
});
