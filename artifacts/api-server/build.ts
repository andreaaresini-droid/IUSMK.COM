import path from "path";
import { fileURLToPath } from "url";
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

// Plugin that resolves @workspace/* imports directly to TypeScript source,
// bypassing pnpm symlinks which Vercel may not set up correctly before esbuild runs.
const workspacePlugin = {
  name: "workspace-resolver",
  setup(build: any) {
    build.onResolve({ filter: /^@workspace\// }, (args: any) => {
      // "@workspace/api-zod"        -> lib/api-zod/src/index.ts
      // "@workspace/db"             -> lib/db/src/index.ts
      // "@workspace/db/schema"      -> lib/db/src/schema/index.ts
      const parts = args.path.replace("@workspace/", "").split("/");
      const pkgName = parts[0];
      const subPath = parts.slice(1);
      const root = path.resolve(__dirname, "../..");
      const resolved = subPath.length > 0
        ? path.join(root, "lib", pkgName, "src", ...subPath, "index.ts")
        : path.join(root, "lib", pkgName, "src", "index.ts");
      return { path: resolved };
    });
  },
};

const sharedEsbuildOptions = {
  platform: "node" as const,
  bundle: true,
  format: "cjs" as const,
  plugins: [workspacePlugin],
  // Shim import.meta.url for CJS bundles
  banner: { js: 'const __importMetaUrl = require("url").pathToFileURL(__filename).href;' },
  define: {
    "import.meta.url": "__importMetaUrl",
    "process.env.NODE_ENV": '"production"',
  },
};

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
