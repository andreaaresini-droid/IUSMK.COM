import { Router } from "express";
import path from "path";
import fs from "fs";
import { verifyVideoToken } from "../lib/auth.js";

const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

const router = Router();

// ── Main streaming endpoint ───────────────────────────────────────────────────
// Supabase Storage / URL remoti → 302 redirect diretto (il browser parla direttamente con CDN)
// Local disk                    → server-side byte-range proxy (video legacy in sviluppo)
router.get("/stream", async (req, res) => {
  const { token } = req.query as { token?: string };

  if (!token) {
    res.status(401).json({ error: "Unauthorized", message: "Token video mancante" });
    return;
  }

  const payload = verifyVideoToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized", message: "Token video non valido o scaduto" });
    return;
  }

  const videoPath = payload.videoPath;
  if (!videoPath) {
    res.status(400).json({ error: "Bad Request", message: "Path video mancante nel token" });
    return;
  }

  // URL remoto: Supabase Storage o Cloudinary legacy → 302 redirect diretto
  if (videoPath.startsWith("https://") || videoPath.startsWith("http://")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.redirect(302, videoPath);
    return;
  }

  // Legacy: file locale (sviluppo / vecchi video su disco)
  streamFromLocalDisk(videoPath, req, res);
});

// ── Local disk streaming (legacy dev videos) ──────────────────────────────────
function streamFromLocalDisk(filename: string, req: any, res: any): void {
  const safeName = path.basename(filename);
  const filePath = path.join(UPLOADS_DIR, safeName);

  if (!filePath.startsWith(UPLOADS_DIR)) {
    res.status(403).json({ error: "Forbidden", message: "Percorso non valido" });
    return;
  }

  if (!fs.existsSync(filePath)) {
    console.error("[video] Local file not found:", filePath);
    res.status(404).json({ error: "Not Found", message: "File video non trovato" });
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const rangeHeader = req.headers.range;

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    res.setHeader("Content-Length", end - start + 1);
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.status(200);
    res.setHeader("Content-Length", fileSize);
    fs.createReadStream(filePath).pipe(res);
  }
}

export default router;
