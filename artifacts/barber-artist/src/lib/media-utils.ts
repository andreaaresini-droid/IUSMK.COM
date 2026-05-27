/**
 * media-utils.ts — shared media normalization for Academy & Courses.
 *
 * Gallery items in the DB can be stored in many formats:
 *   • plain URL string
 *   • { url }, { src }, { imageUrl }, { coverImage }, { coverImageUrl }
 *   • { thumbnail }, { thumbnailUrl }, { poster }, { posterUrl }
 *   • { fileUrl }, { publicUrl }, { href }
 *
 * These helpers always return valid, consistent values.
 */

export type MediaType = "image" | "video";

export interface NormalizedMedia {
  url: string;
  type: MediaType;
  poster?: string;
  mimeType?: string;
}

const IMAGE_EXTS = /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?|$)/i;
const VIDEO_EXTS = /\.(mp4|mov|webm|m4v|avi|mkv|ogv)(\?|$)/i;

function detectTypeFromUrl(url: string): MediaType | null {
  if (!url) return null;
  if (IMAGE_EXTS.test(url)) return "image";
  if (VIDEO_EXTS.test(url)) return "video";
  if (url.includes("/gallery/video/") || url.includes("/api/gallery/video/")) return "video";
  return null;
}

/**
 * Extract the URL string from any media item format.
 * Priority order matches the most common DB storage patterns.
 */
function extractRawUrl(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item !== "object") return "";
  return (
    item.url ||
    item.src ||
    item.imageUrl ||
    item.coverImage ||
    item.coverImageUrl ||
    item.thumbnail ||
    item.thumbnailUrl ||
    item.poster ||
    item.posterUrl ||
    item.fileUrl ||
    item.publicUrl ||
    item.href ||
    ""
  );
}

/**
 * normalizeMedia — converts any media item to { url, type, poster?, mimeType? }.
 *
 * Rules:
 * • blob: URLs are rejected (temporary browser objects)
 * • Explicit `type` / `mimeType` fields take priority over URL extension
 * • URL extension detection is the fallback
 * • Unknown extensions default to "image"
 */
export function normalizeMedia(item: any): NormalizedMedia {
  const url = extractRawUrl(item);

  if (!url || url.startsWith("blob:")) {
    return { url: "", type: "image" };
  }

  let type: MediaType;
  let poster: string | undefined;
  let mimeType: string | undefined;

  if (item && typeof item === "object") {
    mimeType = item.mimeType || item.mime || undefined;

    if (item.type === "video" || mimeType?.startsWith("video/")) {
      type = "video";
    } else if (item.type === "image" || mimeType?.startsWith("image/")) {
      type = "image";
    } else {
      type = detectTypeFromUrl(url) ?? "image";
    }

    const rawPoster =
      item.poster || item.posterUrl || item.thumbnailUrl || item.thumbnail || "";
    if (rawPoster && !rawPoster.startsWith("blob:")) {
      poster = rawPoster;
    }
  } else {
    type = detectTypeFromUrl(url) ?? "image";
  }

  if (import.meta.env.DEV) {
    console.debug("[normalizeMedia]", { raw: item, url, type, poster });
  }

  return { url, type, poster, mimeType };
}

/**
 * normalizeMediaUrl — extracts just the URL string from any media item format.
 * Returns empty string if the item has no valid URL or is a blob.
 */
export function normalizeMediaUrl(item: any): string {
  if (!item) return "";
  const url = extractRawUrl(item);
  return !url || url.startsWith("blob:") ? "" : url;
}

/**
 * normalizeGallery — converts an array of any media items to NormalizedMedia[].
 * Filters out items with no valid URL.
 */
export function normalizeGallery(items: any[]): NormalizedMedia[] {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeMedia).filter((m) => Boolean(m.url));
}

/**
 * resolveCoverUrl — estrae l'URL dell'immagine di copertina da qualsiasi
 * oggetto corso/categoria, provando tutti i possibili nomi di campo.
 *
 * Supporta sia valori stringa diretti che oggetti annidati con url/src/etc.
 * Restituisce null se non trova nessuna immagine valida (no blob).
 */
export function resolveCoverUrl(course: any): string | null {
  if (!course) return null;

  // Ordine di priorità: i campi più comuni prima
  const candidates = [
    course.thumbnailUrl,
    course.coverImageUrl,
    course.coverImage,
    course.thumbnail,
    course.imageUrl,
    course.image,
    course.posterUrl,
    course.poster,
    course.backgroundImageUrl,
    course.backgroundImage,
    course.videoPosterUrl,
    course.videoPoster,
    course.courseThumbnail,      // campo DTO da /customer/my-courses
    course.media?.[0],
    course.additionalMedia?.[0],
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    let url = "";
    if (typeof raw === "string") {
      url = raw;
    } else if (typeof raw === "object") {
      url =
        raw.url       ||
        raw.src       ||
        raw.fileUrl   ||
        raw.publicUrl ||
        raw.imageUrl  ||
        raw.posterUrl ||
        "";
    }
    if (url && !url.startsWith("blob:")) return url;
  }

  return null;
}
