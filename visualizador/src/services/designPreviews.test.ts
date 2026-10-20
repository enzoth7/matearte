import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("./capturePreview", () => ({ captureElementAsBlob: mocks.capture }));
vi.mock("../lib/supabase", () => ({
  supabase: {
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
    rpc: mocks.rpc,
  },
}));

import { requiredDesignPreviewRoles, saveDesignPreviews } from "./designPreviews";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.capture.mockResolvedValue(new Blob(["preview"], { type: "image/png" }));
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

describe("requiredDesignPreviewRoles", () => {
  it("incluye ambos lados del fleje cuando el modelo lo usa", () => {
    expect(requiredDesignPreviewRoles(true)).toEqual(["mate", "virola", "fleje_front", "fleje_back"]);
  });

  it("omite vistas vacías para modelos sin fleje", () => {
    expect(requiredDesignPreviewRoles(false)).toEqual(["mate", "virola"]);
  });
});

describe("saveDesignPreviews", () => {
  const targets = {
    mate: {} as HTMLElement,
    virola: {} as HTMLElement,
    fleje_front: {} as HTMLElement,
    fleje_back: {} as HTMLElement,
  };
  const params = { designId: "design-id", userId: "user-id", targets };

  it.each([false, true])("registra todas las vistas requeridas (fleje: %s)", async (hasFleje) => {
    await saveDesignPreviews({ ...params, hasFleje });
    const roles = requiredDesignPreviewRoles(hasFleje);
    expect(mocks.capture).toHaveBeenCalledTimes(roles.length);
    expect(mocks.upload).toHaveBeenCalledTimes(roles.length);
    expect(mocks.rpc).toHaveBeenCalledWith("replace_design_previews", {
      p_design_id: params.designId,
      p_previews: roles.map((role) => expect.objectContaining({
        role,
        byte_size: 7,
        object_path: expect.stringMatching(new RegExp(`/${role}\\.png$`)),
      })),
    });
  });

  it("reintenta un Load failed en la virola imperial y continúa con ambos lados del fleje", async () => {
    mocks.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "Load failed" } })
      .mockResolvedValueOnce({ error: null });

    await saveDesignPreviews({ ...params, hasFleje: true });

    expect(mocks.upload).toHaveBeenCalledTimes(5);
    expect(mocks.upload.mock.calls[1][0]).toBe(mocks.upload.mock.calls[2][0]);
    expect(mocks.upload.mock.calls[2][2]).toEqual(expect.objectContaining({ upsert: true }));
    expect(mocks.upload.mock.calls[3][0]).toMatch(/\/fleje_front\.png$/);
    expect(mocks.upload.mock.calls[4][0]).toMatch(/\/fleje_back\.png$/);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("no reintenta errores permanentes y limpia los archivos parciales", async () => {
    mocks.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "Forbidden", statusCode: 403 } });

    await expect(saveDesignPreviews({ ...params, hasFleje: false }))
      .rejects.toThrow("No se pudo guardar la vista virola: Forbidden");

    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith([
      expect.stringMatching(/\/mate\.png$/),
      expect.stringMatching(/\/virola\.png$/),
    ]);
  });
});
