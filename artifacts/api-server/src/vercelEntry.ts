/**
 * Vercel serverless entry point.
 * Importa l'app Express e la espone come handler serverless.
 * L'inizializzazione del DB avviene una volta per container (cold start).
 */
import app from "./app.js";
import { initializeDatabase } from "./lib/init.js";
import { autoSeedKB } from "./lib/kb-seed.js";

// Inizializzazione lazy al primo cold start del container
let initialized = false;
const ensureInit = async () => {
  if (initialized) return;
  initialized = true;
  try {
    await initializeDatabase();
    await autoSeedKB();
  } catch (err) {
    console.error("[VERCEL] Initialization error (non-fatal):", err);
  }
};

// Avvia l'inizializzazione immediatamente (non aspettiamo la prima richiesta)
ensureInit();

export default app;
