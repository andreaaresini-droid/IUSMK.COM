import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { UPLOADS_DIR } from "./lib/paths.js";
// Storage: Supabase Storage (immagini/video hanno URL Supabase nel DB)
// Pagamenti: SumUp (Checkout API + webhook auto codice accesso)

try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch {
  // Read-only filesystem in serverless — skip local upload dir creation
}

const app: Express = express();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(
  (pinoHttp as any)({
    logger,
    serializers: {
      req(req: Record<string, any>) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: Record<string, any>) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Raw body per SumUp webhook (deve stare PRIMA di express.json())
app.use("/api/sumup/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// /api/storage/objects — endpoint legacy
app.use("/api/storage/objects", (_req, res) => {
  res.status(404).json({ error: "Not Found", message: "File non più disponibile tramite questa API." });
});

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"];
app.use("/api/uploads", (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (VIDEO_EXTENSIONS.includes(ext)) {
    res.status(403).json({ error: "Forbidden", message: "Accesso diretto ai video non consentito. Usa il player del sito." });
    return;
  }
  next();
}, express.static(UPLOADS_DIR));

// ── Public gallery video streaming ──────────────────────────────────────────
app.use("/api/gallery/video", (req, res) => {
  const videoUrl = req.path.replace(/^\//, "");
  if (videoUrl.startsWith("https://")) {
    res.redirect(302, videoUrl);
    return;
  }
  res.status(404).json({ error: "Not Found", message: "Video non disponibile." });
});

app.use("/api", router);

export default app;
