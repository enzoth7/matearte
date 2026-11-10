import { spawnSync } from "node:child_process";

const projectPaths = new Map([
  ["web", ["paginaweb"]],
  ["gestion", [
    "gestion",
    "personalizador/src",
    "personalizador/public",
    "paginaweb/src/lib/newsletter-confirmation-email.ts",
    "supabase/functions/commerce-email/templates.ts",
    "supabase/functions/lifecycle-email/templates.ts",
  ]],
  ["personalizador", ["personalizador"]],
]);
const sharedPaths = ["shared", ".gitattributes", ".vercelignore", "vercel.json", "scripts/vercel-ignore-build.mjs"];

function git(args, cwd) {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
}

// Vercel builds unless this script exits successfully.
const paths = projectPaths.get(process.argv[2]);
const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA ?? "";
if (!paths || !/^[0-9a-f]{40}$/.test(previousSha)) {
  console.log("No comparable deployment found. Building.");
  process.exit(1);
}

const root = git(["rev-parse", "--show-toplevel"]);
if (root.status !== 0) process.exit(1);
const cwd = root.stdout.trim();

// The last successful deployment can be older than the shallow checkout.
if (git(["cat-file", "-e", `${previousSha}^{commit}`], cwd).status !== 0) {
  if (git(["fetch", "--no-tags", "--depth=1", "origin", previousSha], cwd).status !== 0) {
    console.log("Could not fetch the last successful deployment. Building.");
    process.exit(1);
  }
}

const diff = git(["diff", "--quiet", "--no-ext-diff", previousSha, "HEAD", "--", ...paths, ...sharedPaths], cwd);
if (diff.status === 0) {
  console.log("No changes affecting this project. Skipping.");
  process.exit(0);
}
process.exit(1);
