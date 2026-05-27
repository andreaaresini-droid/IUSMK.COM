import { Router } from "express";
import multer from "multer";
import { requireAdmin } from "../middlewares/authMiddleware.js";
import { uploadImage, uploadVideo, isSupabaseStorageConfigured } from "../lib/supabaseStorage.js";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;   // 4 MB (safe under Vercel limit)
const MAX_VIDEO_SIZE = 4 * 1024 * 1024;   // 4 MB (video grandi → richiedono accesso diretto)

const memStorage = multer.memoryStorage();

const imageUpload = multer({
  storage: memStorage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Formato immagine non valido. Usa JPG, PNG o WebP."));
  },
});

const videoUpload = multer({
  storage: memStorage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Formato video non valido. Usa MP4, MOV o WebM."));
  },
});

const router = Router();
router.use(requireAdmin as any);

// ── Image upload (via server → Supabase Storage) ─────────────────────────────
router.post("/image", (req, res) => {
  imageUpload.single("file")(req as any, res as any, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: `File troppo grande. Massimo ${MAX_IMAGE_SIZE / 1024 / 1024} MB per le immagini.` });
        return;
      }
      res.status(400).json({ error: err.message || "Errore durante il caricamento." });
      return;
    }
    const file = (req as any).file;
    if (!file) { res.status(400).json({ error: "Nessun file ricevuto." }); return; }

    if (!isSupabaseStorageConfigured()) {
      res.status(503).json({ error: "Storage non configurato. Controlla le variabili SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY." });
      return;
    }

    try {
      const { url, thumbnailUrl } = await uploadImage(file.buffer, file.mimetype);
      console.log(`[upload] image → Supabase Storage: ${url}`);
      res.json({ url, thumbnailUrl, originalName: file.originalname, size: file.size });
    } catch (uploadErr: any) {
      console.error("[upload] Supabase Storage image upload error:", uploadErr);
      res.status(500).json({ error: "Errore durante il caricamento su Supabase Storage. Riprova." });
    }
  });
});

// ── Video upload (via server → Supabase Storage) ─────────────────────────────
// Nota: Vercel serverless ha limite 4.5 MB. Per video grandi, usare upload diretto al bucket.
router.post("/video", (req, res) => {
  videoUpload.single("file")(req as any, res as any, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "File troppo grande. Massimo 4 MB via questa API. Per video grandi, carica direttamente su Supabase Storage." });
        return;
      }
      res.status(400).json({ error: err.message || "Errore durante il caricamento." });
      return;
    }
    const file = (req as any).file;
    if (!file) { res.status(400).json({ error: "Nessun file ricevuto." }); return; }

    if (!isSupabaseStorageConfigured()) {
      res.status(503).json({ error: "Storage non configurato." });
      return;
    }

    try {
      const url = await uploadVideo(file.buffer, file.mimetype);
      console.log(`[upload] video → Supabase Storage: ${url}`);
      res.json({ url, finalUrl: url, originalName: file.originalname, size: file.size });
    } catch (uploadErr: any) {
      console.error("[upload] Supabase Storage video upload error:", uploadErr);
      res.status(500).json({ error: "Errore durante il caricamento su Supabase Storage. Riprova." });
    }
  });
});

export default router;
