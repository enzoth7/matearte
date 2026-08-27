import { createHash, randomBytes } from "node:crypto";

export function createOpaqueHandoffCode() {
  const code = randomBytes(32).toString("base64url");
  return {
    code,
    tokenHash: createHash("sha256").update(code).digest("hex"),
  };
}
