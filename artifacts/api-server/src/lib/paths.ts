import path from "path";

// On Vercel/serverless process.cwd() is read-only; use /tmp which is writable.
// In dev, use the project uploads folder.
export const UPLOADS_DIR = process.env.VERCEL
  ? "/tmp/uploads"
  : path.join(process.cwd(), "uploads");
