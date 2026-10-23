// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ upload: vi.fn(), insert: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ isAllowedCustomizerOrigin: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createTokenSupabase: () => ({ auth: { getUser: async () => ({ data: { user: { id: "buyer" } } }) }, from: () => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: { id: "design" } }) }; return chain;
  } }),
  createAdminSupabase: () => ({ storage: { from: () => ({ upload: mock.upload, remove: mock.remove }) }, from: () => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: null }), insert: mock.insert }; return chain;
  } }),
}));
import { POST } from "./route";
beforeEach(() => { vi.clearAllMocks(); mock.upload.mockResolvedValue({ error: null }); mock.insert.mockResolvedValue({ error: null }); });
async function upload(bytes: Uint8Array | string, type: string) {
  const form = new FormData(); form.set("designId", "f1a04858-ed0b-42c6-8dbd-2461374d11f4"); form.set("assetId", "upload-f1a04858-ed0b-42c6-8dbd-2461374d11f4");
  form.set("file", new File([typeof bytes === "string" ? bytes : new Uint8Array(bytes)], "art", { type }));
  return POST(new Request("https://store.test/api/design-assets", { method: "POST", headers: { origin: "https://customizer.test", authorization: "Bearer test" }, body: form }));
}
it("persiste los bytes sanitizados y calcula tamaño y hash sobre esos bytes", async () => {
  expect((await upload('<svg viewBox="0 0 10 10" onload="alert(1)"><path d="M0 0"/></svg>', "image/svg+xml")).status).toBe(201);
  const bytes = mock.upload.mock.calls[0][1] as Buffer;
  expect(bytes.toString()).not.toContain("onload");
  expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ byte_size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }));
});
it("conserva subidas PNG y JPEG y rechaza firmas falsas", async () => {
  expect((await upload(Buffer.from("89504e470d0a1a0a", "hex"), "image/png")).status).toBe(201);
  expect((await upload(Buffer.from("ffd8ff", "hex"), "image/jpeg")).status).toBe(201);
  expect((await upload("not a PNG", "image/png")).status).toBe(400);
  expect(mock.upload).toHaveBeenCalledTimes(2);
});
