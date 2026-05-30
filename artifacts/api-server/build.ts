import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { build as esbuild } from "esbuild";
import { rm, readFile } from "fs/promises";

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

// Resolve workspace packages directly to their TypeScript source,
// bypassing pnpm symlinks which Vercel may not set up before esbuild runs.
const workspaceAlias: Record<string, string> = {
  "@workspace/api-zod": path.resolve(__dirname, "../../lib/api-zod/src/index.ts"),
  "@workspace/db": path.resolve(__dirname, "../../lib/db/src/index.ts"),
  "@workspace/db/schema": path.resolve(__dirname, "../../lib/db/src/schema/index.ts"),
  "@workspace/integrations-openai-ai-server": path.resolve(__dirname, "../../lib/integrations-openai-ai-server/src/index.ts"),
};

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

function buildLibDeclarations() {
  const root = path.resolve(__dirname, "../..");
  const libs = ["lib/db", "lib/api-zod", "lib/integrations-openai-ai-server"];
  for (const lib of libs) {
    const libDir = path.join(root, lib);
    console.log(`generating declarations: ${lib}`);
    execSync(`pnpm exec tsc --build "${libDir}"`, {
      cwd: root,
      stdio: "inherit",
    });
  }
}

async function buildAll() {
  buildLibDeclarations();

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

  console.log("building vercel handler...");
  await esbuild({
    ...sharedEsbuildOptions,
    entryPoints: [path.resolve(__dirname, "src/vercelEntry.ts")],
    outfile: path.resolve(__dirname, "api/index.js"),
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
