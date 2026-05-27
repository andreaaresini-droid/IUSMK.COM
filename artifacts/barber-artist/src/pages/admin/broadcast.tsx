import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import {
  Megaphone, Users, BookOpen, Search, X, CheckSquare, Square,
  Send, Loader2, CheckCircle, AlertCircle, ChevronDown,
  Image, Video, Trash2, Upload, Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Mode = "all" | "with_courses" | "specific_course" | "manual";

const NOTIF_TYPES = [
  { value: "broadcast",         label: "Comunicazione generale" },
  { value: "promo_notification",label: "Promozione" },
  { value: "course_update",     label: "Aggiornamento corso" },
  { value: "account_update",    label: "Aggiornamento account" },
  { value: "reminder",          label: "Promemoria" },
  { value: "system_notification",label: "Notifica di sistema" },
  { value: "admin_notification", label: "Comunicazione admin" },
];

interface UserItem { id: number; name: string; email: string }
interface Course   { id: number; title: string }
interface SendResult {
  success:    boolean;
  matched:    number;
  excluded:   number;
  sent:       number;
  pushFailed: number;
}

function UserCheckbox({ user, checked, onChange }: { user: UserItem; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm transition-colors text-left",
        checked ? "bg-primary/10 border border-primary/20" : "hover:bg-white/5 border border-transparent"
      )}
    >
      {checked ? <CheckSquare size={16} className="text-primary shrink-0" /> : <Square size={16} className="text-white/40 shrink-0" />}
      <span className="flex-1 text-white truncate">{user.name}</span>
      <span className="text-white/40 text-xs truncate max-w-[140px]">{user.email}</span>
    </button>
  );
}

// ─── Media Upload Component ───────────────────────────────────────────────────

function MediaUpload({
  onImageUploaded,
  onVideoUploaded,
  onClear,
  imageUrl,
  videoUrl,
}: {
  onImageUploaded: (url: string) => void;
  onVideoUploaded: (url: string) => void;
  onClear: () => void;
  imageUrl: string;
  videoUrl: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const hasMedia = !!imageUrl || !!videoUrl;

  async function handleFile(file: File, type: "image" | "video") {
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("barber_artist_token");
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${BASE}/api/upload/${type}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload fallito");
      if (type === "image") onImageUploaded(json.url);
      else onVideoUploaded(json.url);
      toast({ title: type === "image" ? "Immagine caricata" : "Video caricato", description: "Allegato pronto per la notifica." });
    } catch (err: any) {
      setError(err.message || "Errore upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        Allegato (opzionale)
      </label>

      {hasMedia ? (
        <div className="relative bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {imageUrl && (
            <div className="relative">
              <img
                src={imageUrl}
                alt="Anteprima"
                className="w-full max-h-48 object-cover"
              />
              <div className="absolute top-0 left-0 px-2 py-1 bg-black/60 text-xs text-white/80 rounded-br-lg flex items-center gap-1">
                <Image size={11} /> Immagine
              </div>
            </div>
          )}
          {videoUrl && (
            <div className="flex items-center gap-3 p-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Play size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Video allegato</p>
                <p className="text-xs text-white/40 mt-0.5">La push indicherà la presenza del video</p>
              </div>
            </div>
          )}
          <button
            onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white/60 hover:text-red-400 hover:border-red-500/30 transition-colors"
            title="Rimuovi allegato"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ) : (
        <div className={cn("flex gap-2", uploading && "opacity-50 pointer-events-none")}>
          <button
            onClick={() => imgRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 border border-dashed border-white/15 hover:border-primary/40 hover:bg-primary/5 rounded-xl py-4 text-white/50 hover:text-white text-sm transition-colors"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Image size={16} />}
            Immagine
          </button>
          <button
            onClick={() => vidRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 border border-dashed border-white/15 hover:border-primary/40 hover:bg-primary/5 rounded-xl py-4 text-white/50 hover:text-white text-sm transition-colors"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
            Video
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      <p className="text-xs text-white/25 mt-2">
        Immagine (JPG/PNG/WebP max 10MB) · Video (MP4/WebM max 500MB). Un solo allegato per notifica.
      </p>

      <input
        ref={imgRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, "image"); e.target.value = ""; }}
      />
      <input
        ref={vidRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, "video"); e.target.value = ""; }}
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminBroadcast() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [authLoading, user, setLocation]);

  const [mode,        setMode]        = useState<Mode>("all");
  const [courseId,    setCourseId]    = useState<number | null>(null);
  const [notifType,   setNotifType]   = useState("broadcast");
  const [title,       setTitle]       = useState("");
  const [message,     setMessage]     = useState("");
  const [url,         setUrl]         = useState("");
  const [imageUrl,    setImageUrl]    = useState("");
  const [videoUrl,    setVideoUrl]    = useState("");
  const [searchQ,     setSearchQ]     = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [excludeIds,  setExcludeIds]  = useState<Set<number>>(new Set());
  const [excludeMode, setExcludeMode] = useState(false);
  const [result,      setResult]      = useState<SendResult | null>(null);

  const { data: courses } = useQuery<Course[]>({
    queryKey: ["admin", "broadcast", "courses"],
    queryFn:  () => fetchApi("/admin/broadcast/courses"),
  });

  const { data: userList, isLoading: usersLoading } = useQuery<UserItem[]>({
    queryKey: ["admin", "broadcast", "accounts", searchQ],
    queryFn:  () => fetchApi(`/admin/broadcast/accounts?search=${encodeURIComponent(searchQ)}`),
    enabled:  mode === "manual" || excludeMode,
  });

  const send = useMutation({
    mutationFn: (body: object) => fetchApi<SendResult>("/admin/broadcast/send", {
      method: "POST",
      body:   JSON.stringify(body),
    }),
    onSuccess: (data) => {
      setResult(data);
      setTitle("");
      setMessage("");
      setUrl("");
      setImageUrl("");
      setVideoUrl("");
      setSelectedIds(new Set());
      setExcludeIds(new Set());
      toast({ title: "Notifica inviata!", description: `${data.matched} destinatari, ${data.sent} push consegnati.` });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message ?? "Impossibile inviare", variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Completa i campi", description: "Titolo e messaggio sono obbligatori.", variant: "destructive" });
      return;
    }
    const body: Record<string, unknown> = {
      mode,
      type:       notifType,
      title:      title.trim(),
      message:    message.trim(),
      excludeIds: excludeMode ? [...excludeIds] : [],
      url:        url.trim() || undefined,
      imageUrl:   imageUrl || undefined,
      videoUrl:   videoUrl || undefined,
    };
    if (mode === "specific_course") body.courseId = courseId;
    if (mode === "manual") body.userIds = [...selectedIds];
    send.mutate(body);
  };

  const toggleUser    = useCallback((id: number) => { setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }, []);
  const toggleExclude = useCallback((id: number) => { setExcludeIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }, []);

  if (authLoading) return null;

  const modeOptions: { value: Mode; label: string; desc: string }[] = [
    { value: "all",             label: "Tutti gli utenti",           desc: "Invia a tutti gli account registrati"         },
    { value: "with_courses",    label: "Utenti con corsi",           desc: "Solo chi ha acquistato almeno un corso"       },
    { value: "specific_course", label: "Uno specifico corso",        desc: "Solo chi ha acquistato il corso selezionato"  },
    { value: "manual",          label: "Selezione manuale",          desc: "Scegli singolarmente i destinatari"           },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-16">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Megaphone size={28} className="text-primary" />
              <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tight">Invio Notifiche</h1>
            </div>
            <p className="text-muted-foreground text-sm">Invia notifiche a gruppi selezionati di utenti. Tutte le notifiche vengono anche inviate come push.</p>
          </div>

          {/* Success banner */}
          {result && (
            <div className="mb-6 p-4 border border-green-500/20 bg-green-500/8 rounded-xl flex items-start gap-3">
              <CheckCircle size={18} className="text-green-400 mt-0.5 shrink-0" />
              <div className="text-sm text-green-200">
                <p className="font-semibold mb-1">Notifica inviata con successo!</p>
                <ul className="text-green-300/80 space-y-0.5">
                  <li>Destinatari: <strong>{result.matched}</strong></li>
                  <li>Esclusi: <strong>{result.excluded}</strong></li>
                  <li>Push consegnati: <strong>{result.sent}</strong></li>
                  {result.pushFailed > 0 && <li>Push falliti / no subscription: <strong>{result.pushFailed}</strong></li>}
                </ul>
              </div>
              <button onClick={() => setResult(null)} className="ml-auto text-green-400/50 hover:text-green-400">
                <X size={16} />
              </button>
            </div>
          )}

          <div className="space-y-6">
            {/* ── Destinatari ── */}
            <div className="bg-card border border-white/8 rounded-xl p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-4 flex items-center gap-2">
                <Users size={14} /> Destinatari
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {modeOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setMode(opt.value); setSelectedIds(new Set()); }}
                    className={cn(
                      "text-left px-4 py-3 rounded-xl border transition-colors",
                      mode === opt.value
                        ? "border-primary/40 bg-primary/10 text-white"
                        : "border-white/8 bg-white/3 text-muted-foreground hover:border-white/15"
                    )}
                  >
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs mt-0.5 opacity-70">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {mode === "specific_course" && (
                <div className="mt-4">
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Seleziona corso</label>
                  <select
                    value={courseId ?? ""}
                    onChange={e => setCourseId(Number(e.target.value))}
                    className="w-full bg-background border border-white/10 text-white px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:border-primary/50"
                  >
                    <option value="">— Scegli un corso —</option>
                    {courses?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              )}

              {mode === "manual" && (
                <div className="mt-4 space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">Seleziona utenti</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      value={searchQ}
                      onChange={e => setSearchQ(e.target.value)}
                      placeholder="Cerca per nome o email..."
                      className="w-full bg-background border border-white/10 text-white pl-8 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-primary/50 placeholder-white/25"
                    />
                  </div>
                  {selectedIds.size > 0 && (
                    <p className="text-xs text-primary font-semibold">{selectedIds.size} selezionat{selectedIds.size === 1 ? "o" : "i"}</p>
                  )}
                  <div className="max-h-56 overflow-y-auto space-y-0.5 rounded-lg border border-white/8 bg-background p-1">
                    {usersLoading && <p className="text-center py-4 text-muted-foreground text-sm">Caricamento...</p>}
                    {!usersLoading && userList?.length === 0 && <p className="text-center py-4 text-muted-foreground text-sm">Nessun utente trovato</p>}
                    {userList?.map(u => <UserCheckbox key={u.id} user={u} checked={selectedIds.has(u.id)} onChange={() => toggleUser(u.id)} />)}
                  </div>
                </div>
              )}
            </div>

            {/* ── Esclusioni ── */}
            <div className="bg-card border border-white/8 rounded-xl p-6">
              <button
                onClick={() => setExcludeMode(!excludeMode)}
                className="flex items-center gap-3 w-full text-sm text-muted-foreground hover:text-white transition-colors"
              >
                {excludeMode ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                <span className="font-semibold">Escludi utenti selezionati</span>
                <ChevronDown size={14} className={cn("ml-auto transition-transform", excludeMode && "rotate-180")} />
              </button>

              {excludeMode && (
                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      value={searchQ}
                      onChange={e => setSearchQ(e.target.value)}
                      placeholder="Cerca utente da escludere..."
                      className="w-full bg-background border border-white/10 text-white pl-8 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-primary/50 placeholder-white/25"
                    />
                  </div>
                  {excludeIds.size > 0 && <p className="text-xs text-amber-400 font-semibold">{excludeIds.size} esclus{excludeIds.size === 1 ? "o" : "i"}</p>}
                  <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-lg border border-white/8 bg-background p-1">
                    {userList?.map(u => <UserCheckbox key={u.id} user={u} checked={excludeIds.has(u.id)} onChange={() => toggleExclude(u.id)} />)}
                  </div>
                </div>
              )}
            </div>

            {/* ── Contenuto notifica ── */}
            <div className="bg-card border border-white/8 rounded-xl p-6 space-y-5">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/60">Contenuto notifica</h2>

              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Tipo notifica</label>
                <select
                  value={notifType}
                  onChange={e => setNotifType(e.target.value)}
                  className="w-full bg-background border border-white/10 text-white px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:border-primary/50"
                >
                  {NOTIF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Titolo */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Titolo *</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="es. Nuovo corso disponibile!"
                  className="w-full bg-background border border-white/10 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-primary/50 placeholder-white/25"
                />
              </div>

              {/* Messaggio */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Messaggio *</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="Testo della notifica..."
                  className="w-full bg-background border border-white/10 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-primary/50 placeholder-white/25 resize-none"
                />
                <p className="text-right text-xs text-white/25 mt-1">{message.length}/500</p>
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">URL di destinazione (opzionale)</label>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="es. /academy o /notifications"
                  className="w-full bg-background border border-white/10 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-primary/50 placeholder-white/25"
                />
                <p className="text-xs text-white/30 mt-1">Cliccando la push, il cliente viene reindirizzato qui.</p>
              </div>

              {/* Allegato immagine / video */}
              <MediaUpload
                imageUrl={imageUrl}
                videoUrl={videoUrl}
                onImageUploaded={(u) => { setImageUrl(u); setVideoUrl(""); }}
                onVideoUploaded={(u) => { setVideoUrl(u); setImageUrl(""); }}
                onClear={() => { setImageUrl(""); setVideoUrl(""); }}
              />
            </div>

            {/* ── Anteprima ── */}
            {(title || message) && (
              <div className="bg-card border border-white/8 rounded-xl p-6">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">Anteprima push</h2>
                <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/8">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    {imageUrl ? <Image size={18} className="text-primary" /> : videoUrl ? <Video size={18} className="text-primary" /> : <Megaphone size={18} className="text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{title || "Titolo notifica"}</p>
                    <p className="text-white/60 text-sm mt-0.5 leading-relaxed">
                      {message || "Messaggio notifica"}
                      {videoUrl && !imageUrl && " 📹 Contiene un video — tocca per visualizzarlo."}
                    </p>
                    {url && <p className="text-primary/70 text-xs mt-1">→ {url}</p>}
                    {imageUrl && (
                      <img src={imageUrl} alt="" className="mt-2 rounded-lg w-full max-h-28 object-cover opacity-80" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-white/25 mt-2">
                  Tipo: <span className="text-white/50">{NOTIF_TYPES.find(t => t.value === notifType)?.label ?? notifType}</span>
                </p>
              </div>
            )}

            {/* ── Invia ── */}
            <button
              onClick={handleSend}
              disabled={
                send.isPending ||
                !title.trim() ||
                !message.trim() ||
                (mode === "specific_course" && !courseId) ||
                (mode === "manual" && selectedIds.size === 0)
              }
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/80 disabled:opacity-40 text-white py-4 font-semibold uppercase tracking-widest text-sm rounded-xl transition-colors"
            >
              {send.isPending
                ? <><Loader2 size={18} className="animate-spin" /> Invio in corso...</>
                : <><Send size={18} /> Invia notifica</>
              }
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
