// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { expect, it, vi } from "vitest";
it("el alta inicial permanece cerrada sin depender de consultas o de un bearer arbitrario", async () => {
  const source = readFileSync(new URL("../../../supabase/functions/gestion-users/index.ts", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");
  const code = ts.transpile(source, { target: ts.ScriptTarget.ES2022 });
  let handler!: (request: Request) => Promise<Response>;
  const client = vi.fn(() => ({}));
  runInNewContext(code, { Deno: { env: { get: () => "" }, serve: (fn: typeof handler) => { handler = fn; } }, createClient: client, Response });
  const request = (action: string) => new Request("https://functions.test", { method: "POST", headers: { authorization: "Bearer arbitrary" }, body: JSON.stringify({ action, username: "owner", password: "test-test" }) });
  expect((await handler(request("bootstrap"))).status).toBe(410);
  expect(await (await handler(request("status"))).json()).toEqual({ needsSetup: false });
});
