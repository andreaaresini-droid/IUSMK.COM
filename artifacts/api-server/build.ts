import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm, readFile } from "fs/promises";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times without risking some
// packages that are not bundle compatible
const allowlist = [
  "@google/generative-ai",
  "@supabase/supabase-js",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "pino",
  "pino-http",
  "uuid",
  "web-push",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

// Map every @workspace/* import directly to its TypeScript source so that
// esbuild bundles it inline — bypassing pnpm symlinks that may be broken
// (or point outside the Lambda root) in the Vercel runtime.
//
// Using esbuild's built-in 'alias' option (exact-match substitution) rather
// than a plugin, so there is no ambiguity about resolution order.
const workspaceAlias: Record<string, string> = {
  "@workspace/api-zod": path.resolve(__dirname, "../../lib/api-zod/src/index.ts"),
  "@workspace/db": path.resolve(__dirname, "../../lib/db/src/index.ts"),
  "@workspace/db/schema": path.resolve(__dirname, "../../lib/db/src/schema/index.ts"),
  "@workspace/integrations-openai-ai-server": path.resolve(__dirname, "../../lib/integrations-openai-ai-server/src/index.ts"),
};

console.log("[build] workspace aliases:", Object.keys(workspaceAlias));

const sharedEsbuildOptions = {
  platform: "node" as const,
  bundle: true,
  format: "cjs" as const,
  alias: workspaceAlias,
  // Shim import.meta.url for CJS bundles
  banner: { js: 'const __importMetaUrl = require("url").pathToFileURL(__filename).href;' },
  define: {
    "import.meta.url": "__importMetaUrl",
    "process.env.NODE_ENV": '"production"',
  },
};

function assertNoWorkspaceLeaks(filePath: string) {
  const src = readFileSync(filePath, "utf-8");
  const matches = src.match(/@workspace\//g);
  if (matches) {
    const count = matches.length;
    const base = path.basename(filePath);
    throw new Error(
      `BUNDLE LEAK in ${base}: found ${count} "@workspace/" references. ` +
      "esbuild did NOT inline workspace packages. Check alias config."
    );
  }
  const base = path.basename(filePath);
  console.log(`[build] OK: no @workspace leaks in ${base}`);
}

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await rm(distDir, { recursive: true, force: true });

  const pkgPath = path.resolve(__dirname, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter(
    (dep) =>
      !allowlist.includes(dep) &&
      !(pkg.dependencies?.[dep]?.startsWith("workspace:")),
  );

  console.log("building server (standalone)...");
  await esbuild({
    ...sharedEsbuildOptions,
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    outfile: path.resolve(distDir, "index.cjs"),
    minify: true,
    external: externals,
    logLevel: "info",
  });
  assertNoWorkspaceLeaks(path.resolve(distDir, "index.cjs"));

  console.log("building vercel handler...");
  await esbuild({
    ...sharedEsbuildOptions,
    entryPoints: [path.resolve(__dirname, "src/vercelEntry.ts")],
    outfile: path.resolve(__dirname, "api/index.js"),
    minify: true,
    external: externals,
    logLevel: "info",
  });
  assertNoWorkspaceLeaks(path.resolve(__dirname, "api/index.js"));
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
