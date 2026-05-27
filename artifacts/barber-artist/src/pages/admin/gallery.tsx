import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import {
  useAdminGallery, useAddGalleryItem, useDeleteGalleryItem, useUpdateGalleryItem,
  useGalleryCategories, useCreateGalleryCategory, useUpdateGalleryCategory, useDeleteGalleryCategory,
} from "@/hooks/use-admin";
import { fetchApi } from "@/lib/api-client";
import {
  Plus, Trash2, ImageIcon, Pencil, Tag, X, Check, FolderOpen, Upload, Loader2, Video, Film,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── URL helpers (stessa priorità della galleria pubblica) ──────────────────────

function resolveImageSrc(item: any): string {
  return item.thumbnailUrl || item.optimizedUrl || item.mobileUrl || item.originalUrl || item.imageUrl || item.url || "";
}

function resolveVideoSrc(item: any): string {
  return item.optimizedUrl || item.videoOptimizedUrl || item.originalUrl || item.imageUrl || item.url || "";
}

function resolveVideoPoster(item: any): string {
  return item.posterUrl || item.thumbnailUrl || item.mobileUrl || "";
}

// ─── EditItemModal ─────────────────────────────────────────────────────────────

function EditItemModal({ item, categories, onClose, onSave }: {
  item: any; categories: any[]; onClose: () => void; onSave: (id: number, data: any) => void;
}) {
  const [title, setTitle] = useState(item.title || "");
  const [category, setCategory] = useState(item.category || "");
  const [saving, setSaving] = useState(false);
  const isVideo = item.mediaType === "video";
  const imgSrc  = resolveImageSrc(item);
  const vidSrc  = resolveVideoSrc(item);
  const poster  = resolveVideoPoster(item);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-white/10 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-white font-bold uppercase tracking-widest text-sm">
            Modifica {isVideo ? "Video" : "Immagine"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-white p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {isVideo ? (
            <div className="relative w-full aspect-video bg-black/40 rounded-lg overflow-hidden">
              <video
                src={vidSrc}
                poster={poster || undefined}
                className="w-full h-full object-cover"
                style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
                muted
                playsInline
                preload="metadata"
              />
              <span className="absolute top-2 left-2 bg-blue-600/90 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded pointer-events-none">VIDEO</span>
            </div>
          ) : (
            <img
              src={imgSrc}
              alt=""
              className="w-full aspect-video object-cover rounded-lg bg-black/40"
              style={{ display: "block" }}
              onError={e => { (e.target as HTMLImageElement).style.opacity = "0.15"; }}
            />
          )}
          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Titolo / Didascalia</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg"
              placeholder="Didascalia opzionale..."
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Categoria</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg"
            >
              <option value="">Nessuna categoria</option>
              {categories.map((c: any) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-white/10">
          <button
            onClick={async () => {
              setSaving(true);
              await onSave(item.id, { title, category });
              setSaving(false);
              onClose();
            }}
            disabled={saving}
            className="flex-1 bg-primary text-white py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest hover:bg-primary/80 disabled:opacity-50 transition-colors"
          >
            {saving ? "Salvataggio..." : "Salva"}
          </button>
          <button onClick={onClose} className="px-4 border border-white/10 text-white rounded-lg text-sm hover:bg-white/5 transition-colors">
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CategoriesPanel ────────────────────────────────────────────────────────────

function CategoriesPanel({ onClose }: { onClose: () => void }) {
  const { data: categories, refetch } = useGalleryCategories();
  const { mutateAsync: createCat, isPending: isCreating } = useCreateGalleryCategory();
  const { mutateAsync: updateCat } = useUpdateGalleryCategory();
  const { mutateAsync: deleteCat } = useDeleteGalleryCategory();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createCat({ name: newName.trim() });
    setNewName("");
    refetch();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-0 md:p-0">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border-l border-white/10 w-full max-w-xs h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <h2 className="text-white font-bold uppercase tracking-widest text-sm flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" /> Categorie
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-white p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {(!categories || categories.length === 0) ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nessuna categoria</p>
          ) : categories.map((cat: any) => (
            <div key={cat.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2.5">
              {editingId === cat.id ? (
                <>
                  <input
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    className="flex-1 bg-transparent text-white text-sm outline-none border-b border-white/20"
                    autoFocus
                    onKeyDown={async e => {
                      if (e.key === "Enter") {
                        await updateCat({ id: cat.id, name: editingName });
                        setEditingId(null);
                        refetch();
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <button onClick={async () => { await updateCat({ id: cat.id, name: editingName }); setEditingId(null); refetch(); }} className="text-green-400 hover:text-green-300 p-1">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-white p-1">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-white text-sm truncate">{cat.name}</span>
                  <button onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }} className="text-muted-foreground hover:text-white p-1">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Eliminare la categoria "${cat.name}"?`)) return;
                      await deleteCat(cat.id);
                      refetch();
                    }}
                    className="text-red-400/60 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-white/10 shrink-0">
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nome nuova categoria..."
              className="flex-1 bg-background border border-white/10 text-white px-3 py-2 text-sm rounded-lg placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={isCreating || !newName.trim()}
              className="bg-primary text-white px-4 py-2 text-sm font-bold rounded-lg hover:bg-primary/80 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              {isCreating ? "..." : "Crea"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── MediaCard ─────────────────────────────────────────────────────────────────

function MediaCard({ item, onEdit, onDelete }: { item: any; onEdit: () => void; onDelete: () => void }) {
  const isVideo = item.mediaType === "video";
  const imgSrc   = resolveImageSrc(item);
  const vidSrc   = resolveVideoSrc(item);
  const poster   = resolveVideoPoster(item);

  return (
    <div className="flex flex-col bg-card/30 border border-white/10 rounded-lg overflow-hidden">
      <div className="relative aspect-square overflow-hidden bg-black/20">
        {isVideo ? (
          <>
            <video
              src={vidSrc}
              poster={poster || undefined}
              className="w-full h-full object-cover"
              style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
              muted
              playsInline
              preload="metadata"
              onMouseOver={e => (e.target as HTMLVideoElement).play().catch(() => {})}
              onMouseOut={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
            />
            <span className="absolute top-2 right-2 bg-blue-600/90 text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded pointer-events-none">VIDEO</span>
          </>
        ) : (
          <>
            <img
              src={imgSrc}
              alt={item.title || item.category || ""}
              className="w-full h-full object-cover"
              style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
              decoding="async"
              onError={e => {
                const el = e.target as HTMLImageElement;
                const fallbacks = [item.optimizedUrl, item.mobileUrl, item.originalUrl, item.imageUrl, item.url].filter(Boolean);
                const idx = fallbacks.indexOf(el.src.replace(window.location.origin, ""));
                const next = fallbacks[idx + 1];
                if (next) { el.src = next; } else { el.style.opacity = "0.15"; }
              }}
            />
            <span className="absolute top-2 right-2 bg-black/50 text-white/70 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded pointer-events-none">IMG</span>
          </>
        )}
        {item.category && (
          <span className="absolute top-2 left-2 bg-black/60 text-primary text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded max-w-[55%] truncate pointer-events-none">
            {item.category.replace(/_/g, " ")}
          </span>
        )}
      </div>
      {item.title && (
        <p className="text-white/70 text-xs px-2.5 pt-2 truncate">{item.title}</p>
      )}
      <div className="flex flex-col sm:flex-row gap-1.5 p-2.5 mt-auto">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-xs font-semibold py-2 rounded transition-colors"
        >
          <Pencil className="w-3.5 h-3.5 shrink-0" /> Modifica
        </button>
        <button
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/15 hover:bg-red-500/30 active:bg-red-500/40 text-red-400 text-xs font-semibold py-2 rounded transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 shrink-0" /> Elimina
        </button>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function AdminGallery() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { data: items, isLoading, refetch } = useAdminGallery();
  const { data: categories } = useGalleryCategories();
  const { mutate: addItem, isPending: isAdding } = useAddGalleryItem();
  const { mutate: deleteItem } = useDeleteGalleryItem();
  const { mutateAsync: updateItem } = useUpdateGalleryItem();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Upload form state
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [form, setForm] = useState({ title: "", category: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [filter, setFilter] = useState<"all" | "image" | "video" | string>("all");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (categories && categories.length > 0 && !form.category) {
      setForm(f => ({ ...f, category: categories[0].slug }));
    }
  }, [categories]);

  if (authLoading) return null;

  const isImage = mediaType === "image";
  const allowedTypes = isImage
    ? ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    : ["video/mp4", "video/quicktime", "video/webm"];
  const MAX_IMAGE_MB = 50;
  const MAX_VIDEO_MB = 500;
  const maxSize = isImage ? MAX_IMAGE_MB : MAX_VIDEO_MB;
  const acceptAttr = isImage ? "image/jpeg,image/jpg,image/png,image/webp" : "video/mp4,video/quicktime,video/webm";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Formato non supportato",
        description: isImage ? "Usa JPG, PNG o WebP." : "Usa MP4, MOV o WebM.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > maxSize * 1024 * 1024) {
      toast({
        title: "File troppo grande",
        description: `Il file supera il limite massimo consentito di ${maxSize}MB per ${isImage ? "le immagini" : "i video"}.`,
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedFile(null);
    setPreview(null);
    setUploadProgress(0);
    setUploadPhase("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setForm({ title: "", category: categories?.[0]?.slug || "" });
  };

  // XHR POST with progress — used for image uploads (goes via server)
  const uploadImageWithProgress = (
    fd: FormData,
    token: string,
  ): Promise<{ url: string; thumbnailUrl?: string }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload/image");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error("Risposta non valida dal server.")); }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || "Errore durante il caricamento."));
          } catch {
            reject(new Error(`Errore ${xhr.status} durante il caricamento.`));
          }
        }
      };
      xhr.onerror = () => reject(new Error("Errore di rete. Controlla la connessione e riprova."));
      xhr.onabort = () => reject(new Error("Caricamento annullato."));
      xhr.send(fd);
    });

  // XHR PUT with progress — used for video uploads directly to GCS (bypasses proxy)
  const uploadVideoToSignedUrl = (
    signedUrl: string,
    file: File,
    onProgress: (pct: number) => void,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signedUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Errore ${xhr.status} durante il caricamento del video su storage.`));
      };
      xhr.onerror = () => reject(new Error("Errore di rete. Controlla la connessione e riprova."));
      xhr.onabort = () => reject(new Error("Caricamento annullato."));
      xhr.send(file);
    });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({ title: `Seleziona ${isImage ? "un'immagine" : "un video"}`, variant: "destructive" });
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setUploadPhase("uploading");
    try {
      const token = localStorage.getItem("barber_artist_token") || "";
      let uploadedUrl: string;
      let imageThumbnailUrl: string | undefined;

      if (isImage) {
        // ── Image: multipart POST through server (50 MB max) ──────────────
        const fd = new FormData();
        fd.append("file", selectedFile);
        const result = await uploadImageWithProgress(fd, token);
        uploadedUrl = result.url;
        imageThumbnailUrl = result.thumbnailUrl;
      } else {
        // ── Video: signed URL direct upload — bypasses Replit proxy limit ──
        // Step 1: ask server for a signed GCS PUT URL (no body sent)
        setUploadProgress(3);
        const initRes = await fetch("/api/upload/video/init", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({}));
          throw new Error(err.error || "Errore nella preparazione dell'upload video.");
        }
        const { signedUrl, finalUrl } = await initRes.json();

        // Step 2: PUT file directly to GCS using signed URL
        await uploadVideoToSignedUrl(signedUrl, selectedFile, (pct) => {
          // map 5 → 98 while uploading
          setUploadProgress(5 + Math.round(pct * 0.93));
        });
        uploadedUrl = finalUrl;
      }

      setUploadPhase("saving");
      addItem(
        {
          imageUrl: uploadedUrl,
          title: form.title,
          category: form.category || "senza_categoria",
          mediaType,
          thumbnailUrl: imageThumbnailUrl || undefined,
        },
        {
          onSuccess: () => {
            resetForm();
            refetch();
            toast({ title: `${isImage ? "Immagine" : "Video"} caricato con successo` });
          },
          onError: () => {
            toast({ title: "Errore", description: "Salvataggio in galleria fallito. Riprova.", variant: "destructive" });
            setUploading(false);
            setUploadPhase("idle");
          },
        },
      );
    } catch (err: any) {
      toast({ title: "Errore di caricamento", description: err.message || "Caricamento fallito.", variant: "destructive" });
      setUploading(false);
      setUploadPhase("idle");
      setUploadProgress(0);
    }
  };

  // ── Filtered items ────────────────────────────────────────────────────────
  const allItems: any[] = Array.isArray(items) ? items : [];
  const filteredItems = allItems.filter(item => {
    if (filter === "all") return true;
    if (filter === "image") return !item.mediaType || item.mediaType === "image";
    if (filter === "video") return item.mediaType === "video";
    return item.category === filter;
  });

  const categoryList: any[] = Array.isArray(categories) ? categories : [];

  const countByType = (t: string) => allItems.filter(i => t === "image" ? (!i.mediaType || i.mediaType === "image") : i.mediaType === t).length;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />

      {showCategories && <CategoriesPanel onClose={() => setShowCategories(false)} />}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          categories={categoryList}
          onClose={() => setEditingItem(null)}
          onSave={async (id, data) => { await updateItem({ id, data }); refetch(); setEditingItem(null); }}
        />
      )}

      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-3 md:mb-0">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wider">Galleria</h1>
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowCategories(true)}
                className="flex items-center gap-2 border border-white/15 text-white px-4 py-2 text-sm font-semibold uppercase tracking-widest hover:bg-white/5 transition-colors rounded-lg"
              >
                <Tag className="w-4 h-4" /> Categorie
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 text-sm font-semibold uppercase tracking-widest hover:bg-primary/80 transition-colors rounded-lg"
              >
                <Plus className="w-4 h-4" /> Aggiungi Contenuto
              </button>
            </div>
          </div>
          <div className="flex gap-2 md:hidden mt-3">
            <button
              onClick={() => setShowCategories(true)}
              className="flex-1 flex items-center justify-center gap-2 border border-white/15 text-white px-3 py-2.5 text-xs font-semibold uppercase tracking-widest hover:bg-white/5 transition-colors rounded-lg"
            >
              <Tag className="w-3.5 h-3.5" /> Categorie
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white px-3 py-2.5 text-xs font-semibold uppercase tracking-widest hover:bg-primary/80 transition-colors rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" /> Aggiungi
            </button>
          </div>
        </div>

        {/* ── Upload Form ─────────────────────────────────────────────── */}
        {showForm && (
          <form onSubmit={handleAdd} className="bg-card/50 border border-white/10 p-6 mb-8 space-y-4 rounded-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold uppercase text-sm tracking-widest">Carica Nuovo Contenuto</h2>
              {/* Type toggle */}
              <div className="flex rounded-lg overflow-hidden border border-white/15">
                <button
                  type="button"
                  onClick={() => { setMediaType("image"); setSelectedFile(null); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase transition-colors ${mediaType === "image" ? "bg-primary text-white" : "text-muted-foreground hover:text-white"}`}
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Immagine
                </button>
                <button
                  type="button"
                  onClick={() => { setMediaType("video"); setSelectedFile(null); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase transition-colors ${mediaType === "video" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-white"}`}
                >
                  <Video className="w-3.5 h-3.5" /> Video
                </button>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl cursor-pointer transition-colors ${preview ? "border-primary/40" : "border-white/15 hover:border-white/30"} overflow-hidden`}
            >
              {preview ? (
                <div className="relative">
                  {isImage ? (
                    <img src={preview} alt="Anteprima" className="w-full max-h-64 object-contain bg-black/40" />
                  ) : (
                    <video src={preview} className="w-full max-h-64 object-contain bg-black/40" controls muted />
                  )}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setSelectedFile(null); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-black transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                    {selectedFile?.name} · {((selectedFile?.size || 0) / 1024 / 1024).toFixed(1)}MB
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  {isImage ? <ImageIcon className="w-10 h-10 mb-3 text-muted-foreground/50" /> : <Video className="w-10 h-10 mb-3 text-muted-foreground/50" />}
                  <p className="text-white font-medium text-sm mb-1">Tocca o clicca per caricare</p>
                  <p className="text-muted-foreground text-xs">
                    {isImage ? "JPG, PNG o WebP · Max 50MB" : "MP4, MOV o WebM · Max 500MB"}
                  </p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={acceptAttr}
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Categoria</label>
                {(!categoryList || categoryList.length === 0) ? (
                  <div className="text-xs text-muted-foreground py-2">
                    Nessuna categoria — <button type="button" onClick={() => setShowCategories(true)} className="text-primary underline">creane una</button>
                  </div>
                ) : (
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg"
                  >
                    {categoryList.map((c: any) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Titolo / Didascalia</label>
                <input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg"
                  placeholder="Opzionale..."
                />
              </div>
            </div>

            {/* Progress bar */}
            {uploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {uploadPhase === "uploading"
                      ? uploadProgress < 100
                        ? `Caricamento in corso… ${uploadProgress}%`
                        : "Upload completato, elaborazione…"
                      : "Salvataggio in galleria…"
                    }
                  </span>
                  <span className="text-primary font-semibold">{uploadPhase === "uploading" ? `${uploadProgress}%` : "✓"}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: uploadPhase === "saving" ? "100%" : `${uploadProgress}%`,
                      background: uploadPhase === "saving" ? "rgb(34 197 94)" : "rgb(239 68 68)",
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={uploading || isAdding || !selectedFile}
                className="bg-primary text-white px-6 py-2.5 text-sm font-semibold uppercase tracking-widest hover:bg-primary/80 transition-colors rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{uploadPhase === "saving" ? "Salvataggio…" : "Caricamento…"}</>
                  : isAdding
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Salvataggio…</>
                  : <><Upload className="w-4 h-4" />Carica {isImage ? "Immagine" : "Video"}</>
                }
              </button>
              <button type="button" onClick={resetForm} disabled={uploading || isAdding} className="border border-white/10 text-white px-6 py-2.5 text-sm rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40">
                Annulla
              </button>
            </div>
          </form>
        )}

        {/* ── Filter Bar ──────────────────────────────────────────────── */}
        {!isLoading && allItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full border transition-colors ${filter === "all" ? "bg-white text-background border-white" : "border-white/15 text-muted-foreground hover:text-white hover:border-white/30"}`}
            >
              Tutti <span className="opacity-60">({allItems.length})</span>
            </button>
            <button
              onClick={() => setFilter("image")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full border transition-colors ${filter === "image" ? "bg-white text-background border-white" : "border-white/15 text-muted-foreground hover:text-white hover:border-white/30"}`}
            >
              <ImageIcon className="w-3 h-3" /> Immagini <span className="opacity-60">({countByType("image")})</span>
            </button>
            <button
              onClick={() => setFilter("video")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full border transition-colors ${filter === "video" ? "bg-blue-600 text-white border-blue-600" : "border-white/15 text-muted-foreground hover:text-white hover:border-white/30"}`}
            >
              <Film className="w-3 h-3" /> Video <span className="opacity-60">({countByType("video")})</span>
            </button>
            {/* category filters */}
            {categoryList.map(cat => {
              const count = allItems.filter(i => i.category === cat.slug).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat.slug}
                  onClick={() => setFilter(cat.slug)}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full border transition-colors ${filter === cat.slug ? "bg-primary text-white border-primary" : "border-white/15 text-muted-foreground hover:text-white hover:border-white/30"}`}
                >
                  {cat.name} <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Grid ────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="bg-card/30 animate-pulse rounded-lg h-48 sm:h-56" />)}
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nessun elemento in galleria ancora.</p>
            <button onClick={() => setShowForm(true)} className="mt-2 text-primary text-sm hover:underline">
              Carica il primo contenuto
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <Film className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nessun elemento corrisponde al filtro selezionato.</p>
            <button onClick={() => setFilter("all")} className="mt-2 text-primary text-sm hover:underline">
              Mostra tutti
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {filteredItems.map((item: any) => (
              <MediaCard
                key={item.id}
                item={item}
                onEdit={() => setEditingItem(item)}
                onDelete={() => { if (confirm(`Eliminare questo ${item.mediaType === "video" ? "video" : "immagine"}?`)) deleteItem(item.id, { onSuccess: refetch }); }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
