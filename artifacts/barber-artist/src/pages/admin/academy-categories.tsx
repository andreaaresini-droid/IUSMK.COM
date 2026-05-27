import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  useAdminAcademyCategories,
  useCreateAcademyCategory,
  useUpdateAcademyCategory,
  useDeleteAcademyCategory,
} from "@/hooks/use-courses";
import { useCurrentUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ResilientImage } from "@/components/ui/resilient-image";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Pencil, Trash2, GraduationCap, BookOpen, Eye, EyeOff, X,
  ImageIcon, Upload, Video, CheckCircle, AlertCircle, RefreshCw,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { compressImageFile } from "@/lib/compress-image";

// ─── Upload helpers (same as courses.tsx) ─────────────────────────────────────

async function uploadImageFile(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const token = localStorage.getItem("barber_artist_token") || "";
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload/image");
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
        catch { reject(new Error(`Errore ${xhr.status} durante il caricamento.`)); }
      }
    };
    xhr.onerror = () => reject(new Error("Errore di rete. Controlla la connessione e riprova."));
    xhr.send(fd);
  });
}

const GCS_CHUNK_SIZE = 8 * 1024 * 1024;

async function uploadVideoFile(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const token = localStorage.getItem("barber_artist_token") || "";
  onProgress(1);
  const initRes = await fetch("/api/upload/video/resumable", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type }),
  });
  if (!initRes.ok) {
    const errBody = await initRes.json().catch(() => ({}));
    throw new Error(errBody.error || "Errore nell'avvio dell'upload video.");
  }
  const { resumableUri, finalUrl } = await initRes.json();
  const fileSize = file.size;
  let offset = 0;
  while (offset < fileSize) {
    const chunkEnd = Math.min(offset + GCS_CHUNK_SIZE, fileSize);
    const chunk = file.slice(offset, chunkEnd);
    let attempts = 0;
    while (true) {
      try {
        const resp = await fetch(resumableUri, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
            "Content-Range": `bytes ${offset}-${chunkEnd - 1}/${fileSize}`,
          },
          body: chunk,
        });
        if (resp.status === 308 || resp.status === 200 || resp.status === 201) {
          offset = chunkEnd;
          onProgress(1 + Math.round((offset / fileSize) * 98));
          break;
        }
        if (resp.status >= 500 && attempts < 3) {
          attempts++;
          await new Promise((r) => setTimeout(r, 1500 * attempts));
          continue;
        }
        throw new Error(`Errore GCS ${resp.status}.`);
      } catch (err: any) {
        attempts++;
        if (attempts >= 3) throw err;
        await new Promise((r) => setTimeout(r, 2000 * attempts));
      }
    }
  }
  onProgress(100);
  return finalUrl;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)$/i.test(url) || url.includes("/gallery/video/");
}
function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

/** Estrae l'URL stringa da un item galleria in qualsiasi formato (string | oggetto). */
function normalizeGalleryUrl(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item !== "object") return "";
  const url =
    item.url           ||
    item.src           ||
    item.fileUrl       ||
    item.publicUrl     ||
    item.imageUrl      ||
    item.posterUrl     ||
    item.href          ||
    item.coverImage    ||
    item.coverImageUrl ||
    item.thumbnailUrl  ||
    item.thumbnail     ||
    "";
  return typeof url === "string" ? url : "";
}

// ─── Gallery slot type ────────────────────────────────────────────────────────
// Each gallery item is either an already-uploaded URL (never re-uploaded)
// or a pending File (queued for upload on submit).

type GallerySlot =
  | { kind: "existing"; url: string }
  | { kind: "pending"; file: File; previewUrl: string };

function initGallerySlots(raw: any[]): GallerySlot[] {
  return (raw || [])
    .map(normalizeGalleryUrl)
    .filter((url: string) => url && !url.startsWith("blob:") && !url.startsWith("data:"))
    .map((url: string) => ({ kind: "existing" as const, url }));
}

// ─── Safe image preview ───────────────────────────────────────────────────────

function SafeImg({ src, alt, className }: { src: string; alt?: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={`flex items-center justify-center bg-white/5 text-muted-foreground text-xs gap-1 ${className || ""}`}>
        <ImageIcon className="w-4 h-4" />
        <span>N/D</span>
      </div>
    );
  }
  return <img src={src} alt={alt || ""} className={className} onError={() => setBroken(true)} />;
}

function SafeVideo({ src, className }: { src: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={`flex items-center justify-center bg-white/5 text-muted-foreground text-xs gap-1 ${className || ""}`}>
        <Video className="w-4 h-4" />
        <span>N/D</span>
      </div>
    );
  }
  return (
    <video
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      className={className}
      onError={() => setBroken(true)}
    />
  );
}

// ─── Image upload field ───────────────────────────────────────────────────────

function ImageUploadField({
  label,
  currentUrl,
  onFileSelect,
  onClear,
  required,
}: {
  label: string;
  currentUrl?: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErr(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErr("Formato non valido. Usa JPG, PNG o WebP.");
      e.target.value = "";
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErr("File troppo grande. Massimo 50 MB.");
      e.target.value = "";
      return;
    }
    if (localPreview) URL.revokeObjectURL(localPreview);
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    onFileSelect(file);
  };

  const handleClear = () => {
    if (localPreview) { URL.revokeObjectURL(localPreview); setLocalPreview(null); }
    if (inputRef.current) inputRef.current.value = "";
    onClear();
  };

  const preview = localPreview || (currentUrl || null);
  const hasPreview = Boolean(preview);

  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>

      {hasPreview && (
        <div className="mb-3 relative w-full h-40 overflow-hidden border border-white/10 bg-black/20">
          <SafeImg src={preview!} alt="" className="w-full h-full object-cover" />
          <div className="absolute top-2 right-2 flex gap-1">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="bg-black/70 hover:bg-black text-white rounded px-2 py-1 text-xs flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Cambia
            </button>
            <button type="button" onClick={handleClear}
              className="bg-red-500/80 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>
          </div>
          {localPreview && (
            <div className="absolute bottom-2 left-2 bg-primary/80 text-white text-xs px-2 py-0.5 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Nuova
            </div>
          )}
        </div>
      )}

      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleChange} className="hidden" />

      {!hasPreview && (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-primary/60 bg-black/20 hover:bg-black/30 text-muted-foreground hover:text-white transition-all py-3 px-4 text-sm font-medium">
          <ImageIcon className="w-4 h-4" /> Carica immagine
        </button>
      )}

      {err && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {err}</p>}
      <p className="text-muted-foreground/50 text-xs mt-1">JPG, PNG, WebP · Max 50 MB</p>
    </div>
  );
}

// ─── Video upload field ───────────────────────────────────────────────────────

function VideoUploadField({
  label,
  currentUrl,
  pendingFile,
  onFileSelect,
  onClear,
}: {
  label: string;
  currentUrl?: string | null;
  pendingFile: File | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (pendingFile) {
      const url = URL.createObjectURL(pendingFile);
      setPendingPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPendingPreviewUrl(null);
    }
  }, [pendingFile]);

  const previewUrl = pendingPreviewUrl || currentUrl || null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErr(null);
    if (!file) return;
    if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type)) {
      setErr("Formato non valido. Usa MP4, MOV o WebM.");
      e.target.value = "";
      return;
    }
    onFileSelect(file);
    e.target.value = "";
  };

  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </label>

      {previewUrl && (
        <div className="mb-3 relative border border-white/10 bg-black overflow-hidden">
          <SafeVideo src={previewUrl} className="w-full aspect-video object-contain" />
          <div className="absolute top-2 right-2 flex gap-1">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="bg-black/70 hover:bg-black text-white rounded px-2 py-1 text-xs flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Cambia
            </button>
            <button type="button" onClick={onClear}
              className="bg-red-500/80 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>
          </div>
          {pendingPreviewUrl && (
            <div className="absolute bottom-2 left-2 bg-primary/80 text-white text-xs px-2 py-0.5 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Nuovo
            </div>
          )}
        </div>
      )}

      <input ref={inputRef} type="file" accept=".mp4,.mov,.webm" onChange={handleChange} className="hidden" />

      {!previewUrl && (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-primary/60 bg-black/20 hover:bg-black/30 text-muted-foreground hover:text-white transition-all py-3 px-4 text-sm font-medium">
          <Video className="w-4 h-4" /> Carica video
        </button>
      )}

      {err && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {err}</p>}
      <p className="text-muted-foreground/50 text-xs mt-1">MP4, MOV, WebM · Max 2 GB</p>
    </div>
  );
}

// ─── Single gallery slot item ─────────────────────────────────────────────────

function GallerySlotItem({
  slot,
  onDelete,
  onReplace,
}: {
  slot: GallerySlot;
  onDelete: () => void;
  onReplace: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isVideo = slot.kind === "existing" ? isVideoUrl(slot.url) : isVideoFile(slot.file);
  const previewSrc = slot.kind === "existing" ? slot.url : slot.previewUrl;

  const handleReplaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"];
    if (!allowed.includes(file.type)) return;
    onReplace(file);
    e.target.value = "";
  };

  return (
    <div className="relative border border-white/10 bg-black overflow-hidden group">
      <div className="aspect-square">
        {isVideo ? (
          <SafeVideo src={previewSrc} className="w-full h-full object-cover" />
        ) : (
          <SafeImg src={previewSrc} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      {/* Type badge */}
      <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1 py-0.5 flex items-center gap-0.5">
        {isVideo ? <Video className="w-2.5 h-2.5" /> : <ImageIcon className="w-2.5 h-2.5" />}
      </div>

      {/* Pending badge */}
      {slot.kind === "pending" && (
        <div className="absolute bottom-1 left-1 bg-primary/80 text-white text-xs px-1 py-0.5">
          Nuovo
        </div>
      )}

      {/* Action buttons — always visible on mobile, hover on desktop */}
      <div className="absolute top-1 right-1 flex flex-col gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <input ref={inputRef} type="file"
          accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm"
          onChange={handleReplaceChange} className="hidden" />
        <button type="button" onClick={() => inputRef.current?.click()}
          title="Sostituisci"
          className="bg-black/70 hover:bg-primary text-white rounded w-6 h-6 flex items-center justify-center">
          <RefreshCw className="w-3 h-3" />
        </button>
        <button type="button" onClick={onDelete}
          title="Elimina"
          className="bg-red-500/80 hover:bg-red-500 text-white rounded w-6 h-6 flex items-center justify-center">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Gallery upload field ─────────────────────────────────────────────────────

function GalleryUploadField({
  slots,
  onChange,
}: {
  slots: GallerySlot[];
  onChange: (slots: GallerySlot[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setErr(null);
    const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"];
    const invalid = files.find(f => !allowed.includes(f.type));
    if (invalid) { setErr(`Formato non supportato: ${invalid.name}. Usa JPG, PNG, WebP, MP4, MOV o WebM.`); e.target.value = ""; return; }
    const newSlots: GallerySlot[] = files.map(file => ({
      kind: "pending" as const,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    onChange([...slots, ...newSlots]);
    e.target.value = "";
  };

  const handleDelete = (i: number) => {
    const slot = slots[i];
    if (slot.kind === "pending") URL.revokeObjectURL(slot.previewUrl);
    onChange(slots.filter((_, idx) => idx !== i));
  };

  const handleReplace = (i: number, file: File) => {
    const slot = slots[i];
    if (slot.kind === "pending") URL.revokeObjectURL(slot.previewUrl);
    const next = [...slots];
    next[i] = { kind: "pending", file, previewUrl: URL.createObjectURL(file) };
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Media dimostrativi ({slots.length})
        </label>
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-bold">
          <Plus className="w-3 h-3" /> Aggiungi
        </button>
      </div>

      <input ref={inputRef} type="file"
        accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm"
        multiple onChange={handleAdd} className="hidden" />

      {slots.length === 0 ? (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-primary/60 bg-black/20 hover:bg-black/30 text-muted-foreground hover:text-white transition-all py-4 px-4 text-sm font-medium">
          <Upload className="w-4 h-4" /> Carica foto e video
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot, i) => (
            <GallerySlotItem
              key={i}
              slot={slot}
              onDelete={() => handleDelete(i)}
              onReplace={(file) => handleReplace(i, file)}
            />
          ))}
        </div>
      )}

      {err && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {err}</p>}
      <p className="text-muted-foreground/50 text-xs mt-1">
        JPG, PNG, WebP, MP4, MOV, WebM · Tocca un media per eliminarlo o sostituirlo
      </p>
    </div>
  );
}

// ─── String list editor ───────────────────────────────────────────────────────

function StringListEditor({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
        <button type="button" onClick={() => onChange([...items, ""])}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-bold">
          <Plus className="w-3 h-3" /> Aggiungi
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={e => { const n = [...items]; n[i] = e.target.value; onChange(n); }}
              placeholder={placeholder}
              className="flex-1 bg-background border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-red-400 hover:text-red-300 p-2"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground/60 italic">Nessuna voce aggiunta</p>}
      </div>
    </div>
  );
}

// ─── Modal form ───────────────────────────────────────────────────────────────

function CategoryModal({ initial, onClose }: { initial: any | null; onClose: () => void }) {
  const createMut = useCreateAcademyCategory();
  const updateMut = useUpdateAcademyCategory();

  // ── Text/scalar fields ──
  const [form, setForm] = useState(() => ({
    title:            initial?.title            || "",
    slug:             initial?.slug             || "",
    shortDescription: initial?.shortDescription || "",
    fullDescription:  initial?.fullDescription  || "",
    orderIndex:       initial?.orderIndex       ?? 0,
    isActive:         initial?.isActive         ?? true,
    whatYouWillLearn: Array.isArray(initial?.whatYouWillLearn) ? initial.whatYouWillLearn : [],
  }));
  const sf = useCallback((key: string, val: any) => setForm(f => ({ ...f, [key]: val })), []);

  // ── Single-file media (thumb, trailer, poster) ──
  // Store the current saved URL, and optionally a pending File to replace it.
  const [thumbUrl,   setThumbUrl]   = useState<string>(initial?.thumbnailUrl    || "");
  const [thumbFile,  setThumbFile]  = useState<File | null>(null);

  const [trailerUrl,  setTrailerUrl]  = useState<string>(initial?.trailerVideoUrl  || "");
  const [trailerFile, setTrailerFile] = useState<File | null>(null);

  const [posterUrl,  setPosterUrl]  = useState<string>(initial?.trailerPosterUrl || "");
  const [posterFile, setPosterFile] = useState<File | null>(null);

  // ── Gallery slots ──
  const [gallerySlots, setGallerySlots] = useState<GallerySlot[]>(() =>
    initGallerySlots(Array.isArray(initial?.galleryImages) ? initial.galleryImages : [])
  );

  // ── Upload state ──
  const [isWorking,  setIsWorking]  = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [uploadPct,  setUploadPct]  = useState(0);
  const [error,      setError]      = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) { setError("Il titolo è obbligatorio."); return; }
    setIsWorking(true);
    setUploadPct(0);

    try {
      // ── Thumbnail + Poster: comprimi e carica in parallelo (se entrambi presenti) ──
      let finalThumbUrl  = thumbUrl;
      let finalPosterUrl = posterUrl;

      if (thumbFile || posterFile) {
        const hasTwo = thumbFile && posterFile;
        setUploadStep(
          hasTwo ? "Compressione e caricamento copertina e poster…" : "Compressione e caricamento copertina…"
        );
        setUploadPct(0);

        const imgJobs: Promise<void>[] = [];
        if (thumbFile) {
          imgJobs.push(
            compressImageFile(thumbFile)
              .then(f => uploadImageFile(f, p => setUploadPct(p)))
              .then(url => { finalThumbUrl = url; })
          );
        }
        if (posterFile) {
          imgJobs.push(
            compressImageFile(posterFile)
              .then(f => uploadImageFile(f, hasTwo ? () => {} : p => setUploadPct(p)))
              .then(url => { finalPosterUrl = url; })
          );
        }
        await Promise.all(imgJobs);
        setUploadPct(100);
      }

      // ── Trailer video ──
      let finalTrailerUrl = trailerUrl;
      if (trailerFile) {
        setUploadStep("Caricamento trailer video…");
        setUploadPct(0);
        finalTrailerUrl = await uploadVideoFile(trailerFile, p => setUploadPct(p));
      }

      // ── Gallery: upload new/replaced items ──
      // Existing slots are never re-uploaded — just carry the URL forward.
      const pendingSlots   = gallerySlots.filter(s => s.kind === "pending") as Array<{ kind: "pending"; file: File; previewUrl: string }>;
      const pendingImages  = pendingSlots.filter(s => !isVideoFile(s.file));
      const pendingVideos  = pendingSlots.filter(s => isVideoFile(s.file));

      setUploadPct(0);

      // Upload images in parallel (fast) — comprimi client-side prima dell'upload
      let imageUrls: string[] = [];
      if (pendingImages.length > 0) {
        setUploadStep(`Compressione e caricamento ${pendingImages.length} immagine/i…`);
        imageUrls = await Promise.all(
          pendingImages.map(s => compressImageFile(s.file).then(f => uploadImageFile(f, () => {})))
        );
      }

      // Upload videos sequentially (GCS resumable)
      const videoUrls: string[] = [];
      for (let i = 0; i < pendingVideos.length; i++) {
        setUploadStep(`Caricamento video ${i + 1} di ${pendingVideos.length}…`);
        setUploadPct(0);
        const url = await uploadVideoFile(pendingVideos[i].file, p => setUploadPct(p));
        videoUrls.push(url);
      }

      // Reconstruct gallery in original order.
      // Filtra URL vuoti, blob temporanei e data URI — solo URL pubblici/stabili nel DB.
      let imgIdx = 0, vidIdx = 0;
      const finalGallery: string[] = gallerySlots
        .map(slot => {
          if (slot.kind === "existing") return slot.url;
          if (isVideoFile(slot.file)) return videoUrls[vidIdx++];
          return imageUrls[imgIdx++];
        })
        .filter((url): url is string => Boolean(url) && !url.startsWith("blob:") && !url.startsWith("data:"));

      setUploadStep("Salvataggio…");
      const payload = {
        ...form,
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        thumbnailUrl:     finalThumbUrl   || null,
        trailerVideoUrl:  finalTrailerUrl || null,
        trailerPosterUrl: finalPosterUrl  || null,
        galleryImages:    finalGallery,
        orderIndex:       parseInt(String(form.orderIndex)) || 0,
        whatYouWillLearn: form.whatYouWillLearn.filter((s: string) => s.trim()),
      };

      if (initial) {
        await updateMut.mutateAsync({ id: initial.id, data: payload });
      } else {
        await createMut.mutateAsync(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || "Errore durante il salvataggio. Riprova.");
    } finally {
      setIsWorking(false);
      setUploadStep(null);
    }
  }

  const hasNewUploads = thumbFile || trailerFile || posterFile || gallerySlots.some(s => s.kind === "pending");

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-card border border-white/10 w-full md:max-w-2xl max-h-[95dvh] overflow-y-auto shadow-2xl rounded-t-2xl md:rounded-none">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h2 className="text-base font-display font-bold text-white uppercase tracking-wider">
              {initial ? "Modifica Categoria" : "Nuova Categoria"}
            </h2>
          </div>
          <button onClick={onClose} disabled={isWorking}
            className="text-muted-foreground hover:text-white p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Upload progress */}
          {isWorking && uploadStep && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm text-primary mb-2">
                <span>{uploadStep}</span>
                {uploadPct > 0 && <span>{uploadPct}%</span>}
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  style={{ width: uploadPct > 0 ? `${uploadPct}%` : "100%" }}
                  className={uploadPct > 0 ? "bg-primary h-1.5 rounded-full transition-all" : "bg-primary h-1.5 rounded-full animate-pulse"}
                />
              </div>
            </div>
          )}

          {/* Titolo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Titolo *</label>
            <input value={form.title} onChange={e => sf("title", e.target.value)}
              placeholder="Es. Taglio Classico"
              className="w-full bg-background border border-white/10 text-white px-3 py-2.5 focus:outline-none focus:border-primary" />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Slug URL (opzionale)</label>
            <input value={form.slug} onChange={e => sf("slug", e.target.value)}
              placeholder="taglio-classico (generato automaticamente se vuoto)"
              className="w-full bg-background border border-white/10 text-white px-3 py-2.5 focus:outline-none focus:border-primary font-mono text-sm" />
          </div>

          {/* Descrizione breve */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Descrizione breve</label>
            <textarea value={form.shortDescription} onChange={e => sf("shortDescription", e.target.value)}
              rows={2} placeholder="Breve testo mostrato in anteprima sulla card"
              className="w-full bg-background border border-white/10 text-white px-3 py-2.5 focus:outline-none focus:border-primary resize-none" />
          </div>

          {/* Descrizione completa */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Descrizione completa</label>
            <textarea value={form.fullDescription} onChange={e => sf("fullDescription", e.target.value)}
              rows={5} placeholder="Testo esteso mostrato nella pagina dettaglio categoria"
              className="w-full bg-background border border-white/10 text-white px-3 py-2.5 focus:outline-none focus:border-primary resize-none" />
          </div>

          {/* Immagine di copertina */}
          <ImageUploadField
            label="Immagine di copertina"
            currentUrl={thumbFile ? null : thumbUrl || null}
            onFileSelect={file => setThumbFile(file)}
            onClear={() => { setThumbFile(null); setThumbUrl(""); }}
          />

          {/* Trailer video */}
          <VideoUploadField
            label="Trailer video"
            currentUrl={trailerFile ? null : trailerUrl || null}
            pendingFile={trailerFile}
            onFileSelect={file => setTrailerFile(file)}
            onClear={() => { setTrailerFile(null); setTrailerUrl(""); }}
          />

          {/* Poster trailer */}
          <ImageUploadField
            label="Poster del trailer (immagine anteprima)"
            currentUrl={posterFile ? null : posterUrl || null}
            onFileSelect={file => setPosterFile(file)}
            onClear={() => { setPosterFile(null); setPosterUrl(""); }}
          />

          {/* Gallery */}
          <GalleryUploadField slots={gallerySlots} onChange={setGallerySlots} />

          {/* Cosa imparerai */}
          <StringListEditor
            label="Cosa imparerai"
            items={form.whatYouWillLearn}
            onChange={v => sf("whatYouWillLearn", v)}
            placeholder="Es. Tecniche di taglio classiche"
          />

          {/* Ordine + Attiva */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Ordine</label>
              <input type="number" value={form.orderIndex} onChange={e => sf("orderIndex", e.target.value)}
                className="w-full bg-background border border-white/10 text-white px-3 py-2.5 focus:outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer" onClick={() => sf("isActive", !form.isActive)}>
                <div className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? "bg-primary" : "bg-white/20"}`}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0"}`} />
                </div>
                <span className="text-sm font-medium text-white">Categoria attiva</span>
              </label>
            </div>
          </div>

          {/* Info velocità */}
          {initial && !hasNewUploads && (
            <p className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-green-500/60" />
              Nessun nuovo media da caricare. Il salvataggio sarà immediato.
            </p>
          )}

          {/* Azioni */}
          <div className="flex gap-3 pt-2 border-t border-white/10">
            <Button type="submit" disabled={isWorking} className="flex-1 uppercase tracking-wider font-bold rounded-none">
              {isWorking ? (uploadStep || "Salvataggio…") : initial ? "Aggiorna Categoria" : "Crea Categoria"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isWorking}
              className="rounded-none border-white/20">
              Annulla
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminAcademyCategories() {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { data: rawCats, isLoading } = useAdminAcademyCategories();
  const deleteMut = useDeleteAcademyCategory();

  const [modal, setModal] = useState<{ open: boolean; cat: any | null }>({ open: false, cat: null });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const cats: any[] = Array.isArray(rawCats) ? rawCats : [];

  useEffect(() => {
    if (!userLoading && currentUser && currentUser.role !== "admin") {
      setLocation("/admin");
    }
  }, [userLoading, currentUser]);

  if (userLoading || !currentUser) return null;
  if (currentUser.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />

      <main className="flex-1 md:ml-64 min-h-screen">
        <div className="p-6 max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-display font-bold text-white uppercase tracking-tight">
                Academy — Categorie
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Gestisci le categorie dell'Academy. I corsi vengono collegati qui.
              </p>
            </div>
            <Button onClick={() => setModal({ open: true, cat: null })}
              className="uppercase tracking-wider font-bold rounded-none">
              <Plus className="w-4 h-4 mr-2" /> Nuova Categoria
            </Button>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full bg-white/5" />)}
            </div>
          ) : cats.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-white/10">
              <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-display text-white uppercase mb-2">Nessuna categoria</h3>
              <p className="text-muted-foreground mb-6">Crea la prima categoria dell'Academy</p>
              <Button onClick={() => setModal({ open: true, cat: null })} className="rounded-none uppercase tracking-wider">
                <Plus className="w-4 h-4 mr-2" /> Crea Categoria
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {cats.map((cat: any) => {
                const courses: any[] = Array.isArray(cat.courses) ? cat.courses : [];
                const published = courses.filter((c: any) => c.isPublished).length;
                return (
                  <div key={cat.id} className="bg-card border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex gap-4 p-4">
                      {/* Thumbnail */}
                      {cat.thumbnailUrl && (
                        <div className="w-24 h-16 shrink-0 overflow-hidden border border-white/10 bg-black">
                          <SafeImg src={cat.thumbnailUrl} alt={cat.title} className="w-full h-full object-cover" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-display font-bold text-white uppercase">{cat.title}</h3>
                          {cat.isActive
                            ? <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 flex items-center gap-1"><Eye className="w-3 h-3" /> Attiva</span>
                            : <span className="text-xs bg-white/5 text-muted-foreground px-2 py-0.5 flex items-center gap-1"><EyeOff className="w-3 h-3" /> Nascosta</span>
                          }
                          {cat.trailerVideoUrl && (
                            <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 flex items-center gap-1">
                              <Video className="w-3 h-3" /> Trailer
                            </span>
                          )}
                        </div>
                        {cat.shortDescription && (
                          <p className="text-muted-foreground text-sm line-clamp-1">{cat.shortDescription}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {courses.length} {courses.length === 1 ? "corso" : "corsi"} ({published} pubblicati)
                          </span>
                          <span className="text-xs text-muted-foreground">Ordine: {cat.orderIndex}</span>
                          {Array.isArray(cat.galleryImages) && cat.galleryImages.length > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" /> {cat.galleryImages.length} media
                            </span>
                          )}
                        </div>
                        {courses.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {courses.slice(0, 4).map((c: any) => (
                              <span key={c.id}
                                className={`text-xs px-2 py-0.5 border ${c.isPublished ? "border-primary/20 text-primary/80 bg-primary/5" : "border-white/10 text-muted-foreground"}`}>
                                {c.title}
                              </span>
                            ))}
                            {courses.length > 4 && (
                              <span className="text-xs text-muted-foreground">+{courses.length - 4} altri</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button size="sm" variant="outline"
                          className="rounded-none border-white/20 hover:border-white/40 h-8"
                          onClick={() => setModal({ open: true, cat })}>
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Modifica
                        </Button>
                        {deleteConfirm === cat.id ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="destructive" className="rounded-none h-8 text-xs"
                              disabled={deleteMut.isPending}
                              onClick={() => { deleteMut.mutate(cat.id, { onSettled: () => setDeleteConfirm(null) }); }}>
                              Elimina
                            </Button>
                            <Button size="sm" variant="ghost" className="rounded-none h-8 text-xs"
                              onClick={() => setDeleteConfirm(null)}>No</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost"
                            className="rounded-none h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => setDeleteConfirm(cat.id)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Elimina
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {modal.open && (
        <CategoryModal
          initial={modal.cat}
          onClose={() => setModal({ open: false, cat: null })}
        />
      )}
    </div>
  );
}
