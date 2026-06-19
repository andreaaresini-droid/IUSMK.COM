import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.iusmk.app",
  appName: "IUSMK",
  // Vite builds the SPA into dist/public (see vite.config.ts build.outDir)
  webDir: "dist/public",
  // Bundle the built web assets inside the app. API calls go to the
  // absolute backend URL via VITE_API_URL, so no live server is needed.
  server: {
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
