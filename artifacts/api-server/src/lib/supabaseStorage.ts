import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "iusmk-media";

/* I video dei corsi sono contenuto a pagamento e stanno in un bucket PRIVATO:
   si raggiungono solo con un URL firmato a scadenza, generato dopo aver
   verificato il token dello studente. Il bucket pubblico BUCKET resta per le
   immagini del sito, che devono essere servite dalla CDN senza firma. */
const VIDEO_BUCKET = "iusmk-videos";

export async function uploadImage(
  buffer: Buffer,
  mimeType: string,
  folder = "images",
): Promise<{ url: string; thumbnailUrl: string }> {
  const ext = mimeType === "image/webp" ? "webp" : mimeType === "image/png" ? "png" : "jpg";
  const filename = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(filename, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw new Error(`Supabase Storage upload error: ${error.message}`);

  const url = getPublicUrl(filename);
  return { url, thumbnailUrl: url };
}

export async function uploadVideo(
  buffer: Buffer,
  mimeType: string,
  folder = "videos",
): Promise<string> {
  const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("webm") ? "webm" : "mp4";
  const filename = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(filename, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw new Error(`Supabase Storage video upload error: ${error.message}`);

  return getPublicUrl(filename);
}

export function getPublicUrl(filename: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

export async function deleteFile(url: string): Promise<void> {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split(`/object/public/${BUCKET}/`);
  if (pathParts.length < 2) return;
  const filePath = pathParts[1];

  const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
  if (error) console.warn(`Supabase Storage delete warning: ${error.message}`);
}

export function isSupabaseStorageConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function createVideoUploadSession(
  mimeType: string,
): Promise<{ resumableUri: string; finalUrl: string }> {
  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("quicktime") ? "mov" : "mp4";
  const filename = `videos/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .createSignedUploadUrl(filename);

  if (error || !data) throw new Error(error?.message || "Errore creazione upload session");

  return {
    resumableUri: data.signedUrl, // PUT directly to this URL — no server proxy needed
    // Si salva il PATH nel bucket privato, non un URL pubblico permanente:
    // l'URL viene firmato di volta in volta da /api/video/stream.
    finalUrl: filename,
  };
}

/** Riconosce i path che vivono nel bucket video privato (es. "videos/<uuid>.mp4"). */
export function isPrivateVideoPath(p: string): boolean {
  return p.startsWith("videos/");
}

export async function getSignedVideoUrl(filename: string, expiresInSeconds = 14400): Promise<string> {
  const { data, error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(filename, expiresInSeconds);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}
