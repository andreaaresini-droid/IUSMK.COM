import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useAdminCourses, useCreateCourse, useUpdateCourse, useDeleteCourse, useArchiveCourse, useUnarchiveCourse } from "@/hooks/use-admin";
import { useAdminAcademyCategories } from "@/hooks/use-courses";
import { useCurrentUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ResilientImage } from "@/components/ui/resilient-image";
import {
  Plus, Trash2, Edit, X, Upload, ImageIcon, Video,
  CheckCircle, AlertCircle, Loader2, ChevronUp, ChevronDown,
  GripVertical, Film, Search, ArrowUpDown, Archive, ArchiveRestore,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { compressImageFile } from "@/lib/compress-image";

const EMPTY_FORM = {
  title: "",
  description: "",
  shortDescription: "",
  level: "beginner",
  price: "",
  durationHours: "",
  isPublished: false,
  paymentLinkUrl: "",
  paymentLinkId: "",
  additionalInfo: "",
  academyCategoryId: null as number | null,
  // Campi backward-compat (non mostrati nella form semplificata)
  fullDescription:  "",
  whatYouWillLearn: [] as string[],
  targetAudience:   [] as string[],
  includedContent:  [] as string[],
  promoText:        "",
  trailerVideoUrl:  "",
  trailerPosterUrl: "",
  backgroundImageUrl: "",
};

// ── Editor lista voci dinamica (Cosa imparerai, A chi è adatto, ecc.) ─────────
function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label:       string;
  items:       string[];
  onChange:    (items: string[]) => void;
  placeholder: string;
}) {
  const addItem = () => onChange([...items, ""]);
  const updateItem = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-bold"
        >
          <Plus className="w-3 h-3" /> Aggiungi
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={e => updateItem(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-background border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:border-primary placeholder-muted-foreground/40"
            />
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="text-muted-foreground hover:text-red-400 transition-colors px-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground/50 py-2">
            Nessuna voce. Clicca "Aggiungi" per inserire la prima.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Gallery slot system (per-item delete/replace, mobile-friendly) ────────────
type GallerySlot =
  | { kind: "existing"; url: string }
  | { kind: "pending"; file: File; previewUrl: string };

/** Estrae l'URL stringa da un item galleria in qualsiasi formato (string | oggetto). */
function extractGalleryUrl(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item !== "object") return "";
  // Prova tutti i possibili nomi di campo — ordine di priorità decrescente
  const url =
    item.url        ||
    item.src        ||
    item.fileUrl    ||
    item.publicUrl  ||
    item.imageUrl   ||
    item.posterUrl  ||
    item.href       ||
    item.coverImage ||
    item.coverImageUrl ||
    item.thumbnailUrl  ||
    item.thumbnail     ||
    "";
  return typeof url === "string" ? url : "";
}

function initGallerySlots(raw: any[]): GallerySlot[] {
  return (raw || [])
    .map((item: any) => extractGalleryUrl(item))
    // Filtra URL vuoti, blob temporanei e data URI che non devono mai essere salvati
    .filter((url: string) => url && !url.startsWith("blob:") && !url.startsWith("data:"))
    .map((url: string) => ({ kind: "existing" as const, url }));
}

function isVideoSlotUrl(url: string) {
  return /\.(mp4|mov|webm|m4v)$/i.test(url) || url.includes("/gallery/video/");
}
function isVideoSlotFile(file: File) {
  return file.type.startsWith("video/");
}

function GallerySlotSafeImg({ src, className }: { src: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return (
    <div className={`flex items-center justify-center bg-white/5 text-muted-foreground text-xs gap-1 ${className || ""}`}>
      <ImageIcon className="w-4 h-4" /><span>N/D</span>
    </div>
  );
  return <img src={src} alt="" className={className} onError={() => setBroken(true)} />;
}

function GallerySlotSafeVideo({ src, className }: { src: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return (
    <div className={`flex items-center justify-center bg-white/5 text-muted-foreground text-xs gap-1 ${className || ""}`}>
      <Film className="w-4 h-4" /><span>N/D</span>
    </div>
  );
  return <video src={src} autoPlay muted loop playsInline preload="metadata" className={className} onError={() => setBroken(true)} />;
}

function GallerySlotItem({ slot, onDelete, onReplace }: { slot: GallerySlot; onDelete: () => void; onReplace: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isVid = slot.kind === "existing" ? isVideoSlotUrl(slot.url) : isVideoSlotFile(slot.file);
  const src = slot.kind === "existing" ? slot.url : slot.previewUrl;

  return (
    <div className="relative border border-white/10 bg-black overflow-hidden group">
      <div className="aspect-square">
        {isVid
          ? <GallerySlotSafeVideo src={src} className="w-full h-full object-cover" />
          : <GallerySlotSafeImg src={src} className="w-full h-full object-cover" />}
      </div>
      <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 py-0.5 flex items-center gap-0.5">
        {isVid ? <Film className="w-2.5 h-2.5" /> : <ImageIcon className="w-2.5 h-2.5" />}
      </div>
      {slot.kind === "pending" && (
        <div className="absolute bottom-1 left-1 bg-primary/80 text-white text-[9px] px-1 py-0.5">Nuovo</div>
      )}
      <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm"
          onChange={e => { const f = e.target.files?.[0]; if (f) { onReplace(f); e.target.value = ""; } }} className="hidden" />
        <button type="button" onClick={() => inputRef.current?.click()} title="Sostituisci"
          className="bg-black/70 hover:bg-primary text-white rounded w-6 h-6 flex items-center justify-center">
          <Upload className="w-3 h-3" />
        </button>
        <button type="button" onClick={onDelete} title="Elimina"
          className="bg-red-500/80 hover:bg-red-500 text-white rounded w-6 h-6 flex items-center justify-center">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function GalleryUploadField({ slots, onChange, label }: { slots: GallerySlot[]; onChange: (s: GallerySlot[]) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setErr(null);
    const allowed = ["image/jpeg","image/png","image/webp","video/mp4","video/quicktime","video/webm"];
    const bad = files.find(f => !allowed.includes(f.type));
    if (bad) { setErr(`Formato non supportato: ${bad.name}`); e.target.value = ""; return; }
    const newSlots: GallerySlot[] = files.map(f => ({ kind: "pending" as const, file: f, previewUrl: URL.createObjectURL(f) }));
    onChange([...slots, ...newSlots]);
    e.target.value = "";
  };
  const handleDelete = (i: number) => {
    const s = slots[i]; if (s.kind === "pending") URL.revokeObjectURL(s.previewUrl);
    onChange(slots.filter((_, idx) => idx !== i));
  };
  const handleReplace = (i: number, file: File) => {
    const s = slots[i]; if (s.kind === "pending") URL.revokeObjectURL(s.previewUrl);
    const next = [...slots];
    next[i] = { kind: "pending", file, previewUrl: URL.createObjectURL(file) };
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {label || "Media aggiuntivi"} ({slots.length})
        </label>
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-bold transition-colors">
          <Plus className="w-3 h-3" /> Aggiungi
        </button>
      </div>
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm" multiple onChange={handleAdd} className="hidden" />
      {slots.length === 0 ? (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-primary/60 bg-black/20 hover:bg-black/30 text-muted-foreground hover:text-white transition-all py-6 px-4 text-sm">
          <ImageIcon className="w-4 h-4" /> Aggiungi foto o video
        </button>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {slots.map((slot, i) => (
            <GallerySlotItem key={i} slot={slot} onDelete={() => handleDelete(i)} onReplace={f => handleReplace(i, f)} />
          ))}
          <button type="button" onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-white/10 hover:border-primary/40 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all aspect-square text-xs">
            <Plus className="w-5 h-5" /> Aggiungi
          </button>
        </div>
      )}
      {err && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {err}</p>}
      <p className="text-muted-foreground/50 text-xs mt-1">JPG, PNG, WebP, MP4, MOV, WebM</p>
    </div>
  );
}

// ── Video picker per il video principale del corso ────────────────────────────
function MainVideoPicker({
  currentUrl,
  pendingFile,
  onFileSelect,
  onClear,
}: {
  currentUrl: string | null;
  pendingFile: File | null;
  onFileSelect: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (pendingFile) {
      const u = URL.createObjectURL(pendingFile);
      setPendingPreviewUrl(u);
      return () => URL.revokeObjectURL(u);
    } else {
      setPendingPreviewUrl(null);
    }
  }, [pendingFile]);

  const previewUrl = pendingPreviewUrl || currentUrl;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErr(null);
    if (!file) return;
    if (!["video/mp4","video/quicktime","video/webm","video/mov"].includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
      setErr("Formato non valido. Usa MP4, MOV o WebM.");
      e.target.value = "";
      return;
    }
    onFileSelect(file);
    e.target.value = "";
  };

  return (
    <div>
      {previewUrl ? (
        <div className="relative border border-white/10 bg-black overflow-hidden mb-3">
          <video src={previewUrl} controls muted playsInline preload="metadata" className="w-full aspect-video object-contain" />
          <div className="absolute top-2 right-2 flex gap-1">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="bg-black/70 hover:bg-black text-white rounded px-2 py-1 text-xs flex items-center gap-1">
              <Upload className="w-3 h-3" /> Cambia
            </button>
            <button type="button" onClick={onClear}
              className="bg-red-500/80 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>
          </div>
          {pendingPreviewUrl && (
            <div className="absolute bottom-2 left-2 bg-primary/80 text-white text-xs px-2 py-0.5 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Nuovo file
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-primary/60 bg-black/20 hover:bg-black/30 text-muted-foreground hover:text-white transition-all py-8 px-4 text-sm font-medium mb-3">
          <Video className="w-5 h-5" /> Carica video del corso
        </button>
      )}
      <input ref={inputRef} type="file" accept=".mp4,.mov,.webm,video/*" onChange={handleChange} className="hidden" />
      {err && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {err}</p>}
      <p className="text-muted-foreground/50 text-xs">MP4, MOV, WebM · Max 2 GB</p>
    </div>
  );
}

interface ModuleItem {
  _key: string;
  id?: number;
  title: string;
  description: string;
  videoUrl: string | null;
  videoFile: File | null;
  durationMinutes: string;
  price: string;
  thumbnailUrl: string;
  paymentLinkUrl: string;
  paymentLinkId: string;
}

let keyCounter = 0;
function newKey() { return `mk-${++keyCounter}-${Date.now()}`; }

function emptyModule(): ModuleItem {
  return {
    _key: newKey(), id: undefined, title: "", description: "",
    videoUrl: null, videoFile: null, durationMinutes: "",
    price: "", thumbnailUrl: "", paymentLinkUrl: "", paymentLinkId: "",
  };
}

// XHR image upload with real progress (goes through server, 50 MB max)
async function uploadImageFile(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const token = localStorage.getItem("barber_artist_token") || "";
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${(import.meta.env.VITE_API_URL as string | undefined) ?? ""}/api/upload/image`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText).url); }
        catch { reject(new Error("Risposta non valida dal server.")); }
      } else {
        try { reject(new Error(JSON.parse(xhr.responseText).error || `Errore ${xhr.status}.`)); }
        catch { reject(new Error(`Errore ${xhr.status} durante il caricamento immagine.`)); }
      }
    };
    xhr.onerror = () => reject(new Error("Errore di rete. Controlla la connessione e riprova."));
    xhr.send(fd);
  });
}

// ── Video upload: browser → Supabase Storage (signed URL, no server proxy) ──────
// Backend creates a signed upload URL; browser PUTs the file directly to Supabase.
// No file data passes through the Vercel serverless function → no 4.5 MB limit.
// Requires Supabase Storage file-size limit ≥ video size (increase in Supabase
// dashboard → Storage → Settings → "File size limit", default 50 MB → set 5 GB+).
async function uploadVideoFile(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const authToken = localStorage.getItem("barber_artist_token") || "";

  // Step 1 — ask backend for a Supabase signed upload URL
  onProgress(1);
  const initRes = await fetch(
    `${(import.meta.env.VITE_API_URL as string | undefined) ?? ""}/api/upload/video/resumable`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type }),
    },
  );
  if (!initRes.ok) {
    const errBody = await initRes.json().catch(() => ({}));
    throw new Error(errBody.error || "Errore nell'avvio dell'upload video.");
  }
  const { resumableUri, finalUrl } = await initRes.json();

  // Step 2 — PUT file directly to Supabase signed URL (browser → Supabase CDN)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", resumableUri);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(1 + Math.round((e.loaded / e.total) * 98));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Errore upload ${xhr.status}: ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Errore di rete durante l'upload. Controlla la connessione."));
    xhr.send(file);
  });

  onProgress(100);
  return finalUrl;
}

function FileUploadField({
  label, accept, maxSizeMB, allowedTypes, currentUrl, onFileSelect,
  fileName, uploaded, error, isImage, required,
}: {
  label: string; accept: string; maxSizeMB: number; allowedTypes: string[];
  currentUrl?: string | null; onFileSelect: (file: File | null) => void;
  fileName?: string; uploaded?: boolean; error?: string; isImage?: boolean; required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setLocalError(null);
    if (!file) { onFileSelect(null); return; }
    if (!allowedTypes.includes(file.type)) {
      setLocalError(`Formato non valido. Usa: ${accept.replace(/\./g, "").toUpperCase()}`);
      e.target.value = ""; return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setLocalError(`File troppo grande. Massimo ${maxSizeMB}MB.`);
      e.target.value = ""; return;
    }
    if (isImage) setLocalPreview(URL.createObjectURL(file));
    onFileSelect(file);
  };

  const previewUrl = localPreview || currentUrl;

  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {isImage && previewUrl && (
        <div className="mb-3 relative w-full h-40 overflow-hidden border border-white/10 bg-black/20">
          <img src={previewUrl} alt="" className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          {localPreview && (
            <div className="absolute bottom-2 right-2 bg-green-500/80 text-white text-xs px-2 py-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Nuova immagine
            </div>
          )}
          {!localPreview && currentUrl && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1">Copertina attuale</div>
          )}
        </div>
      )}
      {!isImage && (fileName || currentUrl) && (
        <div className="mb-3 flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-3">
          <Video className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-white truncate">{fileName || "Video caricato"}</span>
          {uploaded && <CheckCircle className="w-4 h-4 text-green-400 shrink-0 ml-auto" />}
          {currentUrl && !fileName && <span className="text-xs text-muted-foreground ml-auto">Video esistente</span>}
        </div>
      )}
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-primary/60 bg-black/20 hover:bg-black/30 text-muted-foreground hover:text-white transition-all py-3 px-4 text-sm font-medium"
      >
        {isImage ? <ImageIcon className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
        {isImage
          ? localPreview || currentUrl ? "Cambia copertina" : "Carica copertina"
          : fileName || currentUrl ? "Sostituisci video" : "Carica video"}
      </button>
      {(localError || error) && (
        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />{localError || error}
        </p>
      )}
      <p className="text-muted-foreground/50 text-xs mt-1">
        {isImage ? "JPG, PNG, WebP · Max 50MB" : "MP4, MOV, WebM · Max 2GB"}
      </p>
    </div>
  );
}

function ModuleBlock({
  module, index, total, onChange, onRemove, onMoveUp, onMoveDown,
}: {
  module: ModuleItem; index: number; total: number;
  onChange: (updated: Partial<ModuleItem>) => void;
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [titleError, setTitleError] = useState("");

  return (
    <div className="border border-white/10 bg-black/20 rounded-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border-b border-white/10">
        <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
        <Film className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-bold uppercase tracking-widest text-white flex-1">
          Lezione {index + 1}
          {module.id && <span className="text-muted-foreground/50 font-normal ml-2">(ID {module.id})</span>}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            Titolo Video <span className="text-red-400">*</span>
          </label>
          <input
            value={module.title}
            onChange={e => { onChange({ title: e.target.value }); if (e.target.value.trim()) setTitleError(""); }}
            onBlur={() => { if (!module.title.trim()) setTitleError("Il titolo è obbligatorio"); }}
            className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-primary placeholder-muted-foreground/40"
            placeholder="Es. Introduzione al fade professionale"
          />
          {titleError && <p className="text-red-400 text-xs mt-1">{titleError}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            Descrizione Video
          </label>
          <textarea
            value={module.description}
            onChange={e => onChange({ description: e.target.value })}
            rows={2}
            className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-primary placeholder-muted-foreground/40 resize-none"
            placeholder="Cosa viene trattato in questa lezione..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <FileUploadField
              label="File Video"
              accept=".mp4,.mov,.webm"
              maxSizeMB={2048}
              allowedTypes={["video/mp4", "video/quicktime", "video/webm"]}
              currentUrl={module.videoUrl}
              onFileSelect={file => onChange({ videoFile: file })}
              fileName={module.videoFile?.name}
              uploaded={!!module.videoFile}
              isImage={false}
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Durata (min)
            </label>
            <input
              type="number"
              min="1"
              value={module.durationMinutes}
              onChange={e => onChange({ durationMinutes: e.target.value })}
              className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-primary placeholder-muted-foreground/40"
              placeholder="Es. 45"
            />
          </div>
        </div>

        {/* ── Campi per vendita singola lezione ── */}
        <div className="border-t border-white/10 pt-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
            Vendita singola lezione (opzionale)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                Prezzo (€)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={module.price}
                onChange={e => onChange({ price: e.target.value })}
                className="w-full bg-background border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:border-primary placeholder-muted-foreground/40"
                placeholder="Es. 29.00"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                URL Thumbnail Lezione
              </label>
              <input
                value={module.thumbnailUrl}
                onChange={e => onChange({ thumbnailUrl: e.target.value })}
                className="w-full bg-background border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:border-primary placeholder-muted-foreground/40"
                placeholder="https://... oppure /api/upload/..."
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                Payment Link URL
              </label>
              <input
                value={module.paymentLinkUrl}
                onChange={e => onChange({ paymentLinkUrl: e.target.value })}
                className="w-full bg-background border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:border-primary placeholder-muted-foreground/40"
                placeholder="https://buy.stripe.com/..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                ID Payment Link Stripe
              </label>
              <input
                value={module.paymentLinkId}
                onChange={e => onChange({ paymentLinkId: e.target.value })}
                className="w-full bg-background border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:border-primary placeholder-muted-foreground/40"
                placeholder="plink_..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SavedPaymentLink { id: number; name: string; paymentLinkUrl: string; paymentLinkId: string; amount: number | null; }

function PaymentLinkSection({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const { data: savedLinks = [] } = useQuery<SavedPaymentLink[]>({
    queryKey: ["admin", "payment-links"],
    queryFn: () => fetchApi("/admin/payment-links"),
  });

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = parseInt(e.target.value);
    if (!id) {
      // Deselect — reset link-derived fields
      setForm((f: any) => ({ ...f, paymentLinkUrl: "", paymentLinkId: "", price: "" }));
      return;
    }
    const found = savedLinks.find(l => l.id === id);
    if (found) {
      setForm((f: any) => ({
        ...f,
        paymentLinkUrl: found.paymentLinkUrl,
        paymentLinkId:  found.paymentLinkId,
        // Auto-fill price from the payment link amount (kept in form state for the backend)
        price: found.amount != null ? found.amount.toString() : f.price,
      }));
      console.log("[ADMIN COURSES] link selezionato:", found.name, "prezzo auto:", found.amount, "url:", found.paymentLinkUrl);
    }
  }

  const selectedLink = savedLinks.find(l => l.paymentLinkId === form.paymentLinkId) ?? null;
  const selectedLinkId = selectedLink?.id ?? "";

  return (
    <div className="border border-primary/20 bg-primary/5 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Stripe Payment Link</p>

      {savedLinks.length > 0 ? (
        <>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Link di pagamento
            </label>
            <select
              value={selectedLinkId}
              onChange={handleSelect}
              className="w-full bg-background border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary rounded-sm"
            >
              <option value="">— Seleziona un link —</option>
              {savedLinks.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}{l.amount != null ? ` — €${(l.amount).toFixed(2)}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Riepilogo selezione — mostra info utili senza esporre ID tecnici */}
          {selectedLink && (
            <div className="flex items-center gap-3 bg-green-500/8 border border-green-500/20 rounded-lg px-4 py-3">
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{selectedLink.name}</p>
                <p className="text-xs text-white/40">
                  {selectedLink.amount != null ? `€${(selectedLink.amount).toFixed(2)} · ` : ""}
                  URL e prezzo compilati automaticamente
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground/50">
          Aggiungi i tuoi link nella sezione <strong className="text-white">Link Pagamenti</strong> per selezionarli qui.
        </p>
      )}
    </div>
  );
}

function CourseModal({ course, onClose }: { course: any | null; onClose: () => void }) {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState(
    course
      ? {
          title:             course.title            || "",
          description:       course.description      || "",
          shortDescription:  course.shortDescription || "",
          level:             course.level            || "beginner",
          price:             course.price?.toString()         || "",
          durationHours:     course.durationHours?.toString() || "",
          isPublished:       course.isPublished ?? false,
          paymentLinkUrl:    course.paymentLinkUrl  || "",
          paymentLinkId:     course.paymentLinkId   || "",
          additionalInfo:    course.additionalInfo   || "",
          academyCategoryId: course.academyCategoryId ?? null,
          // backward-compat (kept in payload, not shown)
          fullDescription:   course.fullDescription  || "",
          whatYouWillLearn:  (Array.isArray(course.whatYouWillLearn) ? course.whatYouWillLearn : []) as string[],
          targetAudience:    (Array.isArray(course.targetAudience)   ? course.targetAudience   : []) as string[],
          includedContent:   (Array.isArray(course.includedContent)  ? course.includedContent  : []) as string[],
          promoText:         course.promoText        || "",
          trailerVideoUrl:   course.trailerVideoUrl  || "",
          trailerPosterUrl:  course.trailerPosterUrl || "",
          backgroundImageUrl: course.backgroundImageUrl || "",
        }
      : { ...EMPTY_FORM }
  );

  // ── Main video (stored as first module for activation-code compat) ──────────
  const firstModule: any = course?.modules?.[0];
  const [mainVideoUrl, setMainVideoUrl] = useState<string | null>(
    firstModule?.videoUrl || course?.videoUrl || null
  );
  const [mainVideoFile, setMainVideoFile] = useState<File | null>(null);
  const [mainModuleId]  = useState<number | undefined>(firstModule?.id);

  // ── Gallery slots ───────────────────────────────────────────────────────────
  const [gallerySlots, setGallerySlots] = useState<GallerySlot[]>(
    () => initGallerySlots(Array.isArray(course?.galleryImages) ? course.galleryImages : [])
  );

  // ── Cover image + background image ──────────────────────────────────────────
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isWorking, setIsWorking] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const createMutation = useCreateCourse();
  const updateMutation = useUpdateCourse();
  const { data: academyCats } = useAdminAcademyCategories();
  const academyCatList: any[] = Array.isArray(academyCats) ? academyCats : [];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Il titolo è obbligatorio";
    if (!form.description.trim()) e.description = "La descrizione è obbligatoria";
    if (!course && !imageFile) e.image = "La copertina è obbligatoria per creare un corso";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsWorking(true);
    setUploadProgress(0);

    try {
      // 1. Copertina + sfondo: comprimi e carica in parallelo (se entrambi presenti)
      let thumbnailUrl: string | undefined = course?.thumbnailUrl;
      let backgroundImageUrl: string | null = course?.backgroundImageUrl || null;

      if (imageFile || bgImageFile) {
        const hasTwo = imageFile && bgImageFile;
        setUploadStep(
          hasTwo ? "Compressione e caricamento copertina e sfondo..." : "Compressione e caricamento copertina..."
        );
        setUploadProgress(0);

        const jobs: Promise<void>[] = [];
        if (imageFile) {
          jobs.push(
            compressImageFile(imageFile)
              .then(f => uploadImageFile(f, pct => setUploadProgress(pct)))
              .then(url => { thumbnailUrl = url; })
          );
        }
        if (bgImageFile) {
          jobs.push(
            compressImageFile(bgImageFile)
              .then(f => uploadImageFile(f, hasTwo ? () => {} : pct => setUploadProgress(pct)))
              .then(url => { backgroundImageUrl = url; })
          );
        }
        await Promise.all(jobs);
        setUploadProgress(100);
      }

      // 2. Video principale
      let resolvedVideoUrl: string | null = mainVideoUrl;
      if (mainVideoFile) {
        setUploadStep("Caricamento video del corso...");
        setUploadProgress(0);
        resolvedVideoUrl = await uploadVideoFile(mainVideoFile, pct => setUploadProgress(pct));
        setUploadProgress(100);
      }

      // 3. Gallery slots: upload pending in parallel (images) / sequential (videos)
      const resolvedSlots: string[] = [];
      const pendingSlots = gallerySlots
        .map((s, i) => ({ slot: s, i }))
        .filter(({ slot }) => slot.kind === "pending");
      const existingSlots = gallerySlots
        .filter(s => s.kind === "existing")
        .map(s => (s as any).url as string);

      // upload images in parallel
      const pendingImages = pendingSlots.filter(({ slot }) => !isVideoSlotFile((slot as any).file));
      const pendingVideos = pendingSlots.filter(({ slot }) => isVideoSlotFile((slot as any).file));

      if (pendingImages.length > 0) {
        setUploadStep(`Compressione e caricamento ${pendingImages.length} foto galleria...`);
        setUploadProgress(0);
        const uploadedImgs = await Promise.all(
          pendingImages.map(({ slot }) =>
            compressImageFile((slot as any).file)
              .then(f => uploadImageFile(f, () => {}))
          )
        );
        resolvedSlots.push(...uploadedImgs);
        setUploadProgress(100);
      }

      for (let g = 0; g < pendingVideos.length; g++) {
        const { slot } = pendingVideos[g];
        setUploadStep(`Caricamento video galleria ${g + 1} di ${pendingVideos.length}...`);
        setUploadProgress(0);
        const url = await uploadVideoFile((slot as any).file, pct => setUploadProgress(pct));
        setUploadProgress(100);
        resolvedSlots.push(url);
      }

      // Reconstruct gallery preserving order: existing slots first, then new uploads.
      // Filtra URL vuoti, blob temporanei e data URI — solo URL pubblici/stabili nel DB.
      const finalGallery: string[] = gallerySlots.map(s => {
        if (s.kind === "existing") return s.url;
        // pending: find from resolvedSlots (images first, then videos)
        return resolvedSlots.shift() || "";
      }).filter((u): u is string => Boolean(u) && !u.startsWith("blob:") && !u.startsWith("data:"));

      setUploadStep("Salvataggio corso...");
      const coursePayload: any = {
        ...form,
        price:        form.price        ? parseFloat(form.price)        : 0,
        durationHours: form.durationHours ? parseInt(form.durationHours) : null,
        thumbnailUrl,
        paymentLinkUrl: form.paymentLinkUrl?.trim() || null,
        paymentLinkId:  form.paymentLinkId?.trim()  || null,
        additionalInfo: form.additionalInfo?.trim()  || null,
        galleryImages:  finalGallery,
        whatYouWillLearn: form.whatYouWillLearn.filter((s: string) => s.trim()),
        targetAudience:   form.targetAudience.filter((s: string) => s.trim()),
        includedContent:  form.includedContent.filter((s: string) => s.trim()),
        trailerVideoUrl:  form.trailerVideoUrl  || null,
        trailerPosterUrl: form.trailerPosterUrl || null,
        academyCategoryId: form.academyCategoryId ?? null,
        backgroundImageUrl: backgroundImageUrl || null,
      };

      let courseId: number;
      if (course) {
        const updated = await new Promise<any>((resolve, reject) => {
          updateMutation.mutate({ id: course.id, data: coursePayload }, { onSuccess: resolve, onError: reject });
        });
        courseId = updated?.id ?? course.id;
      } else {
        const created = await new Promise<any>((resolve, reject) => {
          createMutation.mutate(coursePayload, { onSuccess: resolve, onError: reject });
        });
        courseId = created?.id;
      }

      // 4. Save main video as module
      if (resolvedVideoUrl !== null || mainVideoFile) {
        const modulePayload = {
          title:     form.title.trim() || "Video del corso",
          videoUrl:  resolvedVideoUrl,
          orderIndex: 0,
        };
        setUploadStep("Salvataggio modulo video...");
        if (mainModuleId) {
          await fetchApi(`/admin/courses/${courseId}/modules/${mainModuleId}`, {
            method: "PUT", body: JSON.stringify(modulePayload),
          });
        } else if (resolvedVideoUrl) {
          await fetchApi(`/admin/courses/${courseId}/modules`, {
            method: "POST", body: JSON.stringify(modulePayload),
          });
        }
      }

      onClose();
    } catch (err: any) {
      setErrors(prev => ({ ...prev, upload: err.message || "Errore durante il salvataggio. Riprova." }));
    } finally {
      setIsWorking(false);
      setUploadStep(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-white/10 w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-card z-10">
          <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider">
            {course ? "Modifica Corso" : "Nuovo Corso"}
          </h2>
          <button onClick={onClose} disabled={isWorking} className="text-muted-foreground hover:text-white transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Categoria Academy */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Categoria Academy
            </label>
            <select
              value={form.academyCategoryId ?? ""}
              onChange={e => setForm({ ...form, academyCategoryId: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full bg-background border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary"
            >
              <option value="">— Nessuna categoria —</option>
              {academyCatList.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.title}</option>
              ))}
            </select>
          </div>

          {/* Titolo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Titolo *
            </label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full bg-background border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary placeholder-muted-foreground/40"
              placeholder="Es. Fading Architettonico Avanzato"
            />
            {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title}</p>}
          </div>

          {/* Descrizione */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Descrizione *
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="w-full bg-background border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary placeholder-muted-foreground/40 resize-none"
              placeholder="Descrizione del corso..."
            />
            {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description}</p>}
          </div>

          {/* Informazioni aggiuntive */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Informazioni aggiuntive / Suggerimenti
            </label>
            <textarea
              value={form.additionalInfo}
              onChange={e => setForm({ ...form, additionalInfo: e.target.value })}
              rows={3}
              className="w-full bg-background border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary placeholder-muted-foreground/40 resize-none text-sm"
              placeholder="Consigli, requisiti, suggerimenti per gli studenti..."
            />
          </div>

          {/* Livello / Durata / Stato */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Livello
              </label>
              <select
                value={form.level}
                onChange={e => setForm({ ...form, level: e.target.value })}
                className="w-full bg-background border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary"
              >
                <option value="beginner">Principiante</option>
                <option value="intermediate">Intermedio</option>
                <option value="advanced">Avanzato</option>
                <option value="master">Master</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Durata (ore)
              </label>
              <input
                type="number" min="1"
                value={form.durationHours}
                onChange={e => setForm({ ...form, durationHours: e.target.value })}
                className="w-full bg-background border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary placeholder-muted-foreground/40"
                placeholder="Es. 4"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Stato
              </label>
              <select
                value={form.isPublished ? "published" : "draft"}
                onChange={e => setForm({ ...form, isPublished: e.target.value === "published" })}
                className="w-full bg-background border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-primary"
              >
                <option value="draft">Bozza</option>
                <option value="published">Pubblicato</option>
              </select>
            </div>
          </div>

          {/* Copertina */}
          <div className="border border-white/10 p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Copertina Corso</h3>
            <FileUploadField
              label="Immagine copertina"
              accept=".jpg,.jpeg,.png,.webp"
              maxSizeMB={50}
              allowedTypes={["image/jpeg","image/jpg","image/png","image/webp"]}
              currentUrl={course?.thumbnailUrl}
              onFileSelect={setImageFile}
              isImage={true}
              error={errors.image}
              required={!course}
            />
          </div>

          {/* Immagine di sfondo hero */}
          <div className="border border-white/10 p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Immagine di sfondo (hero)</h3>
            <p className="text-muted-foreground/50 text-xs mb-4">
              Usata come sfondo nella sezione principale della pagina corso. Lascia vuoto per usare la copertina.
            </p>
            <FileUploadField
              label="Sfondo hero"
              accept=".jpg,.jpeg,.png,.webp"
              maxSizeMB={50}
              allowedTypes={["image/jpeg","image/jpg","image/png","image/webp"]}
              currentUrl={course?.backgroundImageUrl}
              onFileSelect={setBgImageFile}
              isImage={true}
            />
          </div>

          {/* Video principale */}
          <div className="border border-white/10 p-4 space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">Video principale del corso</h3>
              <p className="text-muted-foreground/60 text-xs mt-0.5">
                Carica il video del corso dal tuo dispositivo. Supporta file molto pesanti (2 GB+).
              </p>
            </div>
            <MainVideoPicker
              currentUrl={mainVideoUrl}
              pendingFile={mainVideoFile}
              onFileSelect={f => { setMainVideoFile(f); }}
              onClear={() => { setMainVideoFile(null); setMainVideoUrl(null); }}
            />
          </div>

          {/* Media aggiuntivi */}
          <div className="border border-white/10 p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-1">Media aggiuntivi</h3>
            <p className="text-muted-foreground/60 text-xs mb-4">
              Foto e video dimostrativi visibili nella pagina del corso.
            </p>
            <GalleryUploadField
              slots={gallerySlots}
              onChange={setGallerySlots}
              label="Foto e video"
            />
          </div>

          {/* Stripe Payment Link */}
          <PaymentLinkSection form={form} setForm={setForm} />

          {errors.upload && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {errors.upload}
            </div>
          )}

          {isWorking && uploadStep && (
            <div className="bg-primary/10 border border-primary/30 px-4 py-3 space-y-2">
              <div className="flex items-center gap-3 text-primary text-sm">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span className="flex-1">{uploadStep}</span>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <span className="text-xs font-mono">{uploadProgress}%</span>
                )}
                {uploadProgress === 100 && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
              </div>
              {uploadProgress > 0 && (
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-white/10">
            <button
              type="submit"
              disabled={isWorking}
              className="flex-1 bg-primary text-white py-3 font-semibold uppercase tracking-widest text-sm hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isWorking
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {uploadStep || "Elaborazione..."}</>
                : course ? "Salva Modifiche" : "Crea Corso"
              }
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isWorking}
              className="border border-white/10 text-white px-6 py-3 text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const COURSE_FILTERS = [
  { value: "all",               label: "Tutti" },
  { value: "published",         label: "Pubblicati" },
  { value: "draft",             label: "Bozze" },
  { value: "with_payment",      label: "Con link pagamento" },
  { value: "without_payment",   label: "Senza link" },
  { value: "with_content",      label: "Con video" },
  { value: "without_content",   label: "Senza video" },
];

const COURSE_SORTS = [
  { value: "date_desc", label: "Più recenti" },
  { value: "date_asc",  label: "Più vecchi" },
  { value: "name_az",   label: "A→Z" },
  { value: "name_za",   label: "Z→A" },
  { value: "students",  label: "Più studenti" },
  { value: "price_desc",label: "Prezzo maggiore" },
];

// ── Delete / Archive confirmation modal ──────────────────────────────────────
function DeleteCourseModal({ course, onClose }: { course: any; onClose: () => void }) {
  const deleteMutation  = useDeleteCourse();
  const archiveMutation = useArchiveCourse();
  const isPending = deleteMutation.isPending || archiveMutation.isPending;

  const handleArchive = () => {
    archiveMutation.mutate(course.id, { onSuccess: onClose });
  };
  const handleDelete = () => {
    deleteMutation.mutate(course.id, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Gestisci corso</h2>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">"{course.title}"</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white p-1 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats badge */}
        {course.hasLinkedData && (
          <div className="mx-5 mt-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300 space-y-1">
            <p className="font-semibold text-amber-400">Questo corso ha dati collegati:</p>
            {course.totalCodes > 0     && <p>• {course.totalCodes} codici accesso generati</p>}
            {course.totalStudents > 0  && <p>• {course.totalStudents} studenti attivi</p>}
            {course.purchasesCount > 0 && <p>• {course.purchasesCount} acquisti Stripe</p>}
          </div>
        )}

        {/* Options */}
        <div className="p-5 space-y-3 mt-3">
          {/* Archive */}
          <button
            disabled={isPending}
            onClick={handleArchive}
            className="w-full flex items-start gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-4 text-left transition-all disabled:opacity-50"
          >
            <Archive className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Archivia corso</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nasconde il corso dal sito pubblico. Tutti i dati restano intatti e puoi ripristinarlo in seguito.
                {course.hasLinkedData && " Consigliato quando ci sono studenti o acquisti collegati."}
              </p>
            </div>
            {archiveMutation.isPending && <Loader2 className="w-4 h-4 ml-auto shrink-0 animate-spin text-blue-400" />}
          </button>

          {/* Hard delete */}
          <button
            disabled={isPending}
            onClick={handleDelete}
            className="w-full flex items-start gap-3 bg-destructive/5 hover:bg-destructive/10 border border-destructive/20 hover:border-destructive/40 rounded-xl p-4 text-left transition-all disabled:opacity-50"
          >
            <Trash2 className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Elimina definitivamente</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {course.hasLinkedData
                  ? "Elimina il corso e cancella TUTTI i dati collegati: codici, accessi studenti e acquisti. Azione irreversibile."
                  : "Elimina il corso e tutti i suoi moduli. Azione irreversibile."}
              </p>
            </div>
            {deleteMutation.isPending && <Loader2 className="w-4 h-4 ml-auto shrink-0 animate-spin text-destructive" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminCourses() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const [showArchived, setShowArchived] = useState(false);
  const { data: courses, isLoading } = useAdminCourses(showArchived);
  const archiveMutation   = useArchiveCourse();
  const unarchiveMutation = useUnarchiveCourse();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<any | null>(null);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState("all");
  const [sort, setSort]           = useState("date_desc");

  const filteredCourses = useMemo(() => {
    if (!Array.isArray(courses)) return [];
    const q = search.toLowerCase().trim();
    let list = courses.filter((c: any) => {
      if (q && !c.title?.toLowerCase().includes(q) && !c.description?.toLowerCase().includes(q) && !c.level?.toLowerCase().includes(q) && !c.modules?.some((m: any) => m.title?.toLowerCase().includes(q))) return false;
      const hasContent = (c.modules?.length || 0) > 0 || !!c.videoUrl;
      const hasPayment = !!c.paymentLinkId;
      if (filter === "published"        && !c.isPublished) return false;
      if (filter === "draft"            && c.isPublished) return false;
      if (filter === "with_payment"     && !hasPayment) return false;
      if (filter === "without_payment"  && hasPayment) return false;
      if (filter === "with_content"     && !hasContent) return false;
      if (filter === "without_content"  && hasContent) return false;
      return true;
    });
    list = [...list].sort((a: any, b: any) => {
      if (sort === "date_desc")   return (b.id ?? 0) - (a.id ?? 0);
      if (sort === "date_asc")    return (a.id ?? 0) - (b.id ?? 0);
      if (sort === "name_az")     return (a.title || "").localeCompare(b.title || "", "it");
      if (sort === "name_za")     return (b.title || "").localeCompare(a.title || "", "it");
      if (sort === "students")    return (b.totalStudents ?? 0) - (a.totalStudents ?? 0);
      if (sort === "price_desc")  return (b.price ?? 0) - (a.price ?? 0);
      return 0;
    });
    return list;
  }, [courses, search, filter, sort]);

  const hasActiveFilters = search || filter !== "all" || sort !== "date_desc";

  const resetFilters = () => { setSearch(""); setFilter("all"); setSort("date_desc"); };

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [user, authLoading, setLocation]);

  if (authLoading) return null;

  const openCreate = () => { setEditingCourse(null); setModalOpen(true); };
  const openEdit = (course: any) => { setEditingCourse(course); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingCourse(null); };

  const publishedCount = Array.isArray(courses) ? courses.filter((c: any) => c.isPublished).length : 0;
  const draftCount     = Array.isArray(courses) ? courses.filter((c: any) => !c.isPublished).length : 0;
  const archivedCount  = Array.isArray(courses) ? courses.length : 0;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />

      {modalOpen && <CourseModal course={editingCourse} onClose={closeModal} />}
      {courseToDelete && <DeleteCourseModal course={courseToDelete} onClose={() => setCourseToDelete(null)} />}

      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wider">Corsi</h1>
            <p className="text-muted-foreground text-xs mt-0.5">
              {showArchived
                ? `${archivedCount} archiviati`
                : `${publishedCount} pubblicati · ${draftCount} bozze`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowArchived(v => !v); setSearch(""); setFilter("all"); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${showArchived ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-white/5 text-white/50 border-white/10 hover:text-white"}`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Archiviati</span>
            </button>
            {!showArchived && (
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Nuovo Corso
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        {!showArchived && Array.isArray(courses) && courses.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Totale", value: courses.length, color: "text-white" },
              { label: "Pubblicati", value: publishedCount, color: "text-green-400" },
              { label: "Bozze", value: draftCount, color: "text-yellow-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-card/50 border border-white/5 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-white/40 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="bg-card/40 border border-white/8 rounded-xl p-4 mb-5 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca corso per titolo, livello o modulo..."
              className="w-full bg-background border border-white/10 text-white pl-9 pr-9 py-2.5 text-sm rounded-lg placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter chips + sort */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <div className="flex flex-wrap gap-1">
              {COURSE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${filter === f.value ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-white/50 hover:text-white border border-transparent"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <ArrowUpDown size={13} className="text-white/30" />
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="bg-background border border-white/10 text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-primary/50"
              >
                {COURSE_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {hasActiveFilters && (
              <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors shrink-0">
                <X size={12} /> Reset
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <p className="text-xs text-white/30">{filteredCourses.length} cors{filteredCourses.length === 1 ? "o" : "i"} trovati</p>
          )}
        </div>

        <div className="bg-card border border-white/5 rounded-xl overflow-hidden">

          {/* ── Mobile card list (< md) ─────────────────────────────── */}
          <div className="md:hidden divide-y divide-white/5">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Caricamento...</div>
            ) : filteredCourses.length === 0 ? (
              <div className="p-10 text-center">
                {search ? (
                  <p className="text-muted-foreground text-sm">Nessun corso trovato per "<span className="text-white">{search}</span>"</p>
                ) : (
                  <>
                    <p className="text-muted-foreground text-sm mb-4">Nessun corso ancora</p>
                    <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Crea il primo corso</Button>
                  </>
                )}
              </div>
            ) : (
              filteredCourses.map((course: any) => {
                const moduleCount = course.modules?.length || 0;
                const hasVideo = moduleCount > 0 || !!course.videoUrl;
                return (
                  <div key={course.id} className="p-4 flex gap-3 items-start">
                    {course.thumbnailUrl ? (
                      <ResilientImage
                        src={course.thumbnailUrl}
                        alt=""
                        className="w-16 h-16 object-cover rounded shrink-0"
                        fallbackClassName="w-16 h-16 bg-white/5 rounded flex items-center justify-center shrink-0"
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-white/5 rounded flex items-center justify-center shrink-0">
                        <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm leading-snug mb-1.5 break-words">{course.title}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2.5 text-xs text-muted-foreground">
                        <span className="capitalize">{course.level}</span>
                        <span className="opacity-30">·</span>
                        <span>€{course.price || 0}</span>
                        <span className="opacity-30">·</span>
                        {hasVideo ? (
                          <span className="flex items-center gap-1 text-green-400">
                            <Film className="w-3 h-3" />
                            {moduleCount > 0 ? `${moduleCount} video` : "1 video"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">Nessun video</span>
                        )}
                        <span className="opacity-30">·</span>
                        <span>{course.totalStudents || 0} studenti</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${course.isArchived ? "bg-blue-500/20 text-blue-400" : course.isPublished ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"}`}>
                          {course.isArchived ? "Archiviato" : course.isPublished ? "Pubblicato" : "Bozza"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {course.isArchived ? (
                            <Button
                              size="sm" variant="ghost"
                              className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300"
                              disabled={unarchiveMutation.isPending}
                              onClick={() => unarchiveMutation.mutate(course.id)}
                              title="Ripristina"
                            >
                              <ArchiveRestore className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-white" onClick={() => openEdit(course)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm" variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/20"
                            onClick={() => setCourseToDelete(course)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Desktop table (≥ md) ────────────────────────────────── */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-black/40 text-muted-foreground uppercase tracking-widest text-xs">
              <tr>
                <th className="p-4 font-semibold">Corso</th>
                <th className="p-4 font-semibold">Livello</th>
                <th className="p-4 font-semibold">Prezzo</th>
                <th className="p-4 font-semibold">Lezioni</th>
                <th className="p-4 font-semibold">Stato</th>
                <th className="p-4 font-semibold">Studenti</th>
                <th className="p-4 font-semibold text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Caricamento...</td></tr>
              ) : filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    {search ? (
                      <p className="text-muted-foreground">Nessun corso trovato per "<span className="text-white">{search}</span>"</p>
                    ) : (
                      <>
                        <p className="text-muted-foreground mb-4">Nessun corso ancora</p>
                        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Crea il primo corso</Button>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course: any) => {
                  const moduleCount = course.modules?.length || 0;
                  const hasVideo = moduleCount > 0 || !!course.videoUrl;
                  return (
                    <tr key={course.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-medium text-white max-w-xs">
                        <div className="flex items-center gap-3">
                          {course.thumbnailUrl ? (
                            <ResilientImage
                              src={course.thumbnailUrl}
                              alt=""
                              className="w-12 h-12 object-cover rounded shrink-0"
                              fallbackClassName="w-12 h-12 bg-white/5 rounded flex items-center justify-center shrink-0"
                              loading="eager"
                              fetchPriority="high"
                              decoding="async"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-white/5 rounded flex items-center justify-center shrink-0">
                              <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                            </div>
                          )}
                          <span className="truncate">{course.title}</span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-300 capitalize">{course.level}</td>
                      <td className="p-4 text-gray-300">€{course.price || 0}</td>
                      <td className="p-4">
                        {hasVideo ? (
                          <span className="flex items-center gap-1.5 text-green-400 text-xs">
                            <Film className="w-3.5 h-3.5" />
                            {moduleCount > 0 ? `${moduleCount} video` : "1 (legacy)"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${course.isArchived ? "bg-blue-500/20 text-blue-400" : course.isPublished ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"}`}>
                          {course.isArchived ? "Archiviato" : course.isPublished ? "Pubblicato" : "Bozza"}
                        </span>
                      </td>
                      <td className="p-4 text-gray-300">{course.totalStudents || 0}</td>
                      <td className="p-4 text-right space-x-1">
                        {course.isArchived ? (
                          <Button
                            size="sm" variant="ghost"
                            className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300"
                            disabled={unarchiveMutation.isPending}
                            onClick={() => unarchiveMutation.mutate(course.id)}
                            title="Ripristina"
                          >
                            <ArchiveRestore className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-white" onClick={() => openEdit(course)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/20"
                          onClick={() => setCourseToDelete(course)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </main>
    </div>
  );
}
