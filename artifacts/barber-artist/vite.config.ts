import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const isBuild = process.env.NODE_ENV === "production" || process.argv.includes("build");

const rawPort = process.env.PORT;
if (!rawPort && !isBuild) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort || "3000");
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // three.js e i suoi pezzi: niente gruppo fisso. Rollup li mette nei
          // file caricati solo quando serve il logo 3D. Con un gruppo fisso
          // "vendor-three" la libreria (~1 MB) si scaricava all'apertura.
          if (/node_modules\/(three|three-stdlib|@react-three|troika|camera-controls|maath|meshline|stats-gl|detect-gpu|hls\.js|@monogrid|@use-gesture)/.test(id)) return undefined;
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("@tanstack")) return "vendor-query";
          // Use exact package-name regex to avoid accidentally matching paths
          // like node_modules/some-pkg/react/... which would pull packages that
          // import from vendor into vendor-react, creating a circular chunk dep.
          if (
            /node_modules\/react\//.test(id) ||
            /node_modules\/react-dom\//.test(id) ||
            /node_modules\/scheduler\//.test(id)
          ) return "vendor-react";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          return undefined;
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
