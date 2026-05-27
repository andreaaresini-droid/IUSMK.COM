import { Router } from "express";
import multer from "multer";
import { requireAdmin } from "../middlewares/authMiddleware.js";
import {
  isCloudinaryConfigured,
  isCloudinaryUrl,
  uploadImage,
  uploadVideo,
  generateVideoUploadParams,
} from "../lib/cloudinary.js";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

// Vercel serverless ha un limite di 4.5 MB per il body della richiesta.
// Per i video grandi usiamo upload diretto browser → Cloudinary.
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;   // 4 MB (safe under Vercel limit)
const MAX_VIDEO_SIZE = 4 * 1024 * 1024;   // 4 MB fallback (grandi → /video/init)

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

// ── Image upload (via server → Cloudinary) ───────────────────────────────────
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

    if (!isCloudinaryConfigured()) {
      res.status(503).json({ error: "Storage non configurato. Contatta l'amministratore." });
      return;
    }

    try {
      const { url, thumbnailUrl } = await uploadImage(file.buffer, file.mimetype);
      console.log(`[upload] image → Cloudinary: ${url}`);
      res.json({ url, thumbnailUrl, originalName: file.originalname, size: file.size });
    } catch (uploadErr: any) {
      console.error("[upload] Cloudinary image upload error:", uploadErr);
      res.status(500).json({ error: "Errore durante il caricamento su Cloudinary. Riprova." });
    }
  });
});

// ── Video upload — Step 1: ottieni parametri firmati per upload diretto ──────
//    Il browser caricherà il video DIRETTAMENTE su Cloudinary (nessun proxy server).
//    Questo evita il limite di 4.5 MB di Vercel serverless per file grandi.
//
//    Flusso:
//    1. Browser → POST /api/upload/video/init  → riceve { upload_url, signature, ... }
//    2. Browser → POST upload_url (Cloudinary)  → riceve { secure_url, public_id, ... }
//    3. Browser → POST /api/upload/video/complete { secureUrl } → salva URL in DB
router.post("/video/init", async (_req: any, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(503).json({ error: "Storage non configurato." });
    return;
  }
  try {
    const params = generateVideoUploadParams();
    res.json(params);
  } catch (err: any) {
    console.error("[upload] Video init error:", err);
    res.status(500).json({ error: err.message || "Errore nella generazione dei parametri di upload." });
  }
});

// ── Video upload — Step 3: conferma URL Cloudinary dopo upload diretto ───────
router.post("/video/complete", async (req: any, res) => {
  const { secureUrl } = req.body as { secureUrl?: string };
  if (!secureUrl || !isCloudinaryUrl(secureUrl)) {
    res.status(400).json({ error: "URL video non valido." });
    return;
  }
  // L'URL Cloudinary è già il finalUrl — il frontend lo usa direttamente
  res.json({ url: secureUrl, finalUrl: secureUrl });
});

// ── Video upload fallback (file piccoli < 4 MB via server) ───────────────────
router.post("/video", (req, res) => {
  videoUpload.single("file")(req as any, res as any, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "File troppo grande per questo metodo. Usa l'upload diretto per video grandi." });
        return;
      }
      res.status(400).json({ error: err.message || "Errore durante il caricamento." });
      return;
    }
    const file = (req as any).file;
    if (!file) { res.status(400).json({ error: "Nessun file ricevuto." }); return; }

    if (!isCloudinaryConfigured()) {
      res.status(503).json({ error: "Storage non configurato." });
      return;
    }

    try {
      const url = await uploadVideo(file.buffer, file.mimetype);
      console.log(`[upload] video → Cloudinary: ${url}`);
      res.json({ url, finalUrl: url, originalName: file.originalname, size: file.size });
    } catch (uploadErr: any) {
      console.error("[upload] Cloudinary video upload error:", uploadErr);
      res.status(500).json({ error: "Errore durante il caricamento su Cloudinary. Riprova." });
    }
  });
});

export default router;
