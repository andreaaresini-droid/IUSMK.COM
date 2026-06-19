import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm, readFile, writeFile, mkdir } from "fs/promises";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowlist = [
  "@anthropic-ai/sdk",
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

// Workspace packages to pre-compile.
// key = npm package name, value = map of export subpath -> absolute TS source file
const WORKSPACE_PACKAGES: Record<string, Record<string, string>> = {
  "@workspace/api-zod": {
    ".": path.resolve(__dirname, "../../lib/api-zod/src/index.ts"),
  },
  "@workspace/db": {
    ".": path.resolve(__dirname, "../../lib/db/src/index.ts"),
    "./schema": path.resolve(__dirname, "../../lib/db/src/schema/index.ts"),
  },
  "@workspace/integrations-openai-ai-server": {
    ".": path.resolve(__dirname, "../../lib/integrations-openai-ai-server/src/index.ts"),
  },
};

/**
 * Replace every @workspace/* pnpm symlink with a REAL directory containing
 * the package compiled to CJS JavaScript.  This means:
 *
 *  (a) esbuild can bundle the package even without the alias option
 *  (b) if a require(@workspace/...) somehow survives into the final bundle,
 *      Node.js can load the compiled JS at runtime without needing .ts support
 */
async function setupWorkspacePackages() {
  console.log("[build] pre-compiling workspace packages...");

  for (const [pkgName, exports] of Object.entries(WORKSPACE_PACKAGES)) {
    // node_modules/@workspace/api-zod  (or db, etc.)
    const parts = pkgName.split("/"); // ["@workspace", "api-zod"]
    const pkgDir = path.resolve(__dirname, "node_modules", ...parts);

    // Remove the pnpm symlink (or whatever is there) and create a real dir
    await rm(pkgDir, { recursive: true, force: true });
    await mkdir(pkgDir, { recursive: true });

    const exportsMap: Record<string, string> = {};

    for (const [subpath, tsFile] of Object.entries(exports)) {
      // subpath "."         -> index.js
      // subpath "./schema"  -> schema/index.js
      const rel = subpath === "." ? "index.js" : subpath.replace(/^\.\//g, "") + ".js";
      const outFile = path.join(pkgDir, rel);
      await mkdir(path.dirname(outFile), { recursive: true });

      await esbuild({
        entryPoints: [tsFile],
        outfile: outFile,
        bundle: true,      // bundle everything: local imports AND npm deps
        // No external packages — make each pre-compiled file fully self-contained.
        // npm packages like zod are NOT in the Lambda's node_modules (they are
        // bundled inside api/index.js), so we must inline them here too.
        format: "cjs",
        platform: "node",
        logLevel: "silent",
      });

      // Create a real .d.ts alongside the .js so TypeScript finds types.
      // We re-export from the original .ts source (path without extension);
      // TypeScript follows this relative import, finds the .ts file, and
      // gets proper types. skipLibCheck:true means the .d.ts itself is not
      // type-checked — it just acts as a pointer.
      const dtsFile = outFile.replace(/\.js$/, ".d.ts");
      const relToSrc = path.relative(pkgDir, tsFile)
        .replace(/\\/g, "/")
        .replace(/\.ts$/, "");
      await writeFile(dtsFile, `export * from "${relToSrc}";
`);

      exportsMap[subpath] = "./" + rel;
    }

    // Write a package.json that uses the compiled JS for runtime and points
    // TypeScript to the generated .d.ts stubs (which re-export from the
    // original TS source) so tsc can find types without TS7016.
    const structuredExports: Record<string, unknown> = {};
    for (const [subpath, jsPath] of Object.entries(exportsMap)) {
      // .d.ts stub sits alongside the .js file
      const dtsEntry = jsPath.replace(/\.js$/, ".d.ts");
      structuredExports[subpath] = { types: dtsEntry, default: jsPath };
    }
    await writeFile(
      path.join(pkgDir, "package.json"),
      JSON.stringify(
        { name: pkgName, main: "./index.js", types: "./index.d.ts", exports: structuredExports },
        null,
        2,
      ),
    );

    console.log("[build]   compiled:", pkgName, "->", Object.values(exportsMap).join(", "));
  }
}

// Also alias workspace imports in esbuild so it bundles the TS source directly,
// avoiding an extra JS->JS roundtrip.  This is an optimisation on top of the
// pre-compiled fallback above.
const workspaceAlias: Record<string, string> = Object.fromEntries(
  Object.entries(WORKSPACE_PACKAGES).flatMap(([pkg, exports]) =>
    Object.entries(exports).map(([subpath, tsFile]) => {
      const key = subpath === "." ? pkg : pkg + "/" + subpath.replace(/^\.\//g, "");
      return [key, tsFile];
    }),
  ),
);

const sharedEsbuildOptions = {
  platform: "node" as const,
  bundle: true,
  format: "cjs" as const,
  alias: workspaceAlias,
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
      "BUNDLE LEAK in " + base + ": found " + count + " @workspace/ references. " +
      "esbuild did NOT inline workspace packages. Check alias + pre-compile step.",
    );
  }
  const base = path.basename(filePath);
  console.log("[build] OK: no @workspace leaks in " + base);
}

async function buildAll() {
  // 1. Replace pnpm workspace symlinks with real compiled-JS directories
  await setupWorkspacePackages();

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
