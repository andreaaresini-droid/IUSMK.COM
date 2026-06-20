/**
 * Vercel serverless entry point.
 * Importa l'app Express e la espone come handler serverless.
 *
 * NOTA serverless: il seeding della Knowledge Base fa molti insert sequenziali.
 * Se lanciato fire-and-forget al module-load, la Lambda può congelarsi dopo la
 * prima risposta lasciando il seed incompleto (KB vuota → assistente sempre in
 * fallback). Per questo la prima richiesta ATTENDE il completamento di init+seed,
 * così gira interamente dentro un'invocazione attiva. La promise è memoizzata:
 * le richieste successive trovano init già risolto (costo zero).
 */
import type { Request, Response } from "express";
import app from "./app.js";
import { initializeDatabase } from "./lib/init.js";
import { autoSeedKB } from "./lib/kb-seed.js";

let initPromise: Promise<void> | null = null;
const ensureInit = (): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await initializeDatabase();
        await autoSeedKB();
        console.log("[VERCEL] Inizializzazione completata (DB + KB seed)");
      } catch (err) {
        console.error("[VERCEL] Initialization error (non-fatal):", err);
        // Permetti un nuovo tentativo al prossimo cold start / richiesta
        initPromise = null;
      }
    })();
  }
  return initPromise;
};

// Avvia subito al cold start (best effort) — ma la prima richiesta attende comunque.
ensureInit();

export default async function handler(req: Request, res: Response) {
  await ensureInit();
  return (app as unknown as (req: Request, res: Response) => void)(req, res);
}
