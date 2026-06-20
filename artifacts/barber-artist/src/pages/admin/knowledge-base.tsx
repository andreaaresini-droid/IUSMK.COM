import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Brain, Plus, Pencil, Trash2, Check, X, Eye, EyeOff, Power, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type KBItem = {
  id: number;
  title: string;
  content: string;
  category: string;
  keywords: string;
  sourceType: string;
  sourcePath: string;
  isPublished: boolean;
  isActive: boolean;
  createdBy: string;
  lastUpdatedBy: string;
  createdAt: string;
  updatedAt: string;
};

const CATEGORIES = [
  "generale", "servizi", "prezzi", "orari", "contatti", "faq",
  "policy", "prenotazioni", "corsi", "booking", "account",
];

const SOURCE_TYPES = [
  { value: "manual_entry", label: "Voce manuale" },
  { value: "site_page",    label: "Pagina sito" },
  { value: "faq",          label: "FAQ" },
  { value: "policy",       label: "Policy" },
  { value: "service",      label: "Servizio" },
  { value: "pricing",      label: "Prezzi" },
  { value: "contact",      label: "Contatto" },
  { value: "booking",      label: "Prenotazione" },
  { value: "admin_answer", label: "Risposta admin" },
];

const emptyForm = {
  title: "", content: "", category: "generale", keywords: "",
  sourceType: "manual_entry", sourcePath: "", isPublished: true, isActive: true,
};

export default function AdminKnowledgeBase() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<number | null>(null);
  const [form,     setForm]     = useState(emptyForm);
  const [search,   setSearch]   = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [pubFilter, setPubFilter] = useState<"all" | "published" | "draft">("all");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [user, authLoading, setLocation]);

  const { data: items = [], isLoading } = useQuery<KBItem[]>({
    queryKey: ["admin", "knowledge-base"],
    queryFn:  () => fetchApi("/admin/ai/knowledge-base"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) =>
      fetchApi("/admin/ai/knowledge-base", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "knowledge-base"] });
      cancelForm();
      toast({ title: "Voce creata" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof emptyForm> }) =>
      fetchApi(`/admin/ai/knowledge-base/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "knowledge-base"] });
      cancelForm();
      toast({ title: "Voce aggiornata" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/admin/ai/knowledge-base/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "knowledge-base"] });
      toast({ title: "Voce eliminata" });
    },
  });

  const cancelForm = () => { setShowForm(false); setEditId(null); setForm(emptyForm); };

  const startEdit = (item: KBItem) => {
    setEditId(item.id);
    setForm({
      title: item.title, content: item.content, category: item.category,
      keywords: item.keywords || "", sourceType: item.sourceType, sourcePath: item.sourcePath || "",
      isPublished: item.isPublished, isActive: item.isActive,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = ""; // permette di ricaricare lo stesso file
    if (!file) return;
    const isTxt = /\.txt$/i.test(file.name) || file.type === "text/plain";
    if (!isTxt) {
      toast({ title: "Carica un file .txt", variant: "destructive" });
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) {
        toast({ title: "Il file è vuoto", variant: "destructive" });
        return;
      }
      const title = (file.name.replace(/\.txt$/i, "").trim() || "Documento").slice(0, 255);
      createMutation.mutate({
        ...emptyForm,
        title,
        content: text,
        sourcePath: file.name,
      });
    } catch {
      toast({ title: "Errore nella lettura del file", variant: "destructive" });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: "Titolo e contenuto obbligatori", variant: "destructive" }); return;
    }
    if (editId !== null) updateMutation.mutate({ id: editId, data: form });
    else createMutation.mutate(form);
  };

  const categories = ["all", ...Array.from(new Set(items.map((i) => i.category)))];

  const filtered = items.filter((i) => {
    const matchSearch = search === "" || i.title.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()) || (i.keywords || "").toLowerCase().includes(search.toLowerCase());
    const matchCat    = catFilter === "all" || i.category === catFilter;
    const matchPub    = pubFilter === "all" || (pubFilter === "published" ? (i.isPublished && i.isActive) : (!i.isPublished || !i.isActive));
    return matchSearch && matchCat && matchPub;
  });

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wider flex items-center gap-3">
              <Brain className="w-7 h-7 text-violet-400" />
              Knowledge Base AI
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Solo le voci <span className="text-green-400">pubblicate</span> e <span className="text-green-400">attive</span> sono usate dall'assistente
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={createMutation.isPending}
              title="Carica un file .txt: il suo contenuto diventa una voce pubblicata che l'assistente leggerà"
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Carica .txt
            </button>
            <button
              onClick={() => { cancelForm(); setShowForm((s) => !s); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuova voce
            </button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-card border border-white/10 rounded-xl p-5 mb-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              {editId !== null ? "Modifica voce" : "Nuova voce"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Titolo *</label>
                  <input
                    type="text" required maxLength={255}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-primary/50"
                    placeholder="Es. Orari di apertura"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#111]">{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Contenuto *</label>
                <textarea
                  required rows={5}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-primary/50 resize-y"
                  placeholder="Descrivi in dettaglio questa informazione…"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Parole chiave (virgola separata)</label>
                  <input
                    type="text"
                    value={form.keywords}
                    onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-primary/50"
                    placeholder="Es. orari, apertura, chiusura"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tipo sorgente</label>
                  <select
                    value={form.sourceType}
                    onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                  >
                    {SOURCE_TYPES.map((s) => <option key={s.value} value={s.value} className="bg-[#111]">{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Percorso sorgente (opzionale)</label>
                <input
                  type="text"
                  value={form.sourcePath}
                  onChange={(e) => setForm((f) => ({ ...f, sourcePath: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-primary/50"
                  placeholder="Es. /orari oppure https://example.com/info"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox" checked={form.isPublished}
                    onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <span className="text-sm text-white/70">Pubblicato</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox" checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <span className="text-sm text-white/70">Attivo</span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editId !== null ? "Aggiorna" : "Crea"}
                </button>
                <button type="button" onClick={cancelForm} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 rounded-xl text-sm transition-colors flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Annulla
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca…"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-primary/50 w-48"
          />
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-primary/50"
          >
            {categories.map((c) => <option key={c} value={c} className="bg-[#111]">{c === "all" ? "Tutte categorie" : c}</option>)}
          </select>
          {(["all", "published", "draft"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPubFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs border transition-colors",
                pubFilter === f ? "bg-primary/15 text-primary border-primary/30" : "bg-white/5 text-white/50 border-white/10 hover:text-white"
              )}
            >
              {f === "all" ? "Tutte" : f === "published" ? "Attive" : "Inattive"}
            </button>
          ))}
        </div>

        {/* Stats + debug bar */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 mb-4 text-xs text-muted-foreground items-center">
          <span>{items.filter((i) => i.isPublished && i.isActive).length} <span className="text-green-400">attive</span></span>
          <span>{items.filter((i) => !i.isPublished || !i.isActive).length} <span className="text-white/30">inattive</span></span>
          <span>{items.length} totale</span>
          <span className="text-white/20">|</span>
          <span className="font-mono text-[10px] text-white/30">
            DB:{items.length} → filtro:{filtered.length} → mostrate:{filtered.length}
            {items.length === 0 && !isLoading && (
              <span className="ml-2 text-yellow-500">⚠ Nessun dato ricevuto dal server</span>
            )}
          </span>
          {isLoading && <span className="text-white/30 font-mono text-[10px]">⏳ caricamento…</span>}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4].map((i) => <div key={i} className="h-16 bg-card rounded-xl animate-pulse border border-white/5" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nessuna voce trovata.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const isInactive = !item.isPublished || !item.isActive;
              return (
                <div key={item.id} className={cn("bg-card border rounded-xl px-4 py-3 flex items-start gap-3 transition-colors", isInactive ? "border-white/5 opacity-60" : "border-white/8")}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-white font-medium">{item.title}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {item.category}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">
                        {SOURCE_TYPES.find((s) => s.value === item.sourceType)?.label ?? item.sourceType}
                      </span>
                      {!item.isPublished && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Non pubbl.</span>}
                      {!item.isActive   && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Inattivo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.content}</p>
                    {item.keywords && (
                      <p className="text-[10px] text-white/20 mt-0.5">🏷 {item.keywords}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Toggle published */}
                    <button
                      onClick={() => updateMutation.mutate({ id: item.id, data: { isPublished: !item.isPublished } })}
                      title={item.isPublished ? "Nascondi" : "Pubblica"}
                      className={cn("p-1.5 rounded-lg transition-colors", item.isPublished ? "text-green-400 hover:bg-green-500/10" : "text-white/20 hover:bg-white/10")}
                    >
                      {item.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    {/* Toggle active */}
                    <button
                      onClick={() => updateMutation.mutate({ id: item.id, data: { isActive: !item.isActive } })}
                      title={item.isActive ? "Disattiva" : "Attiva"}
                      className={cn("p-1.5 rounded-lg transition-colors", item.isActive ? "text-blue-400 hover:bg-blue-500/10" : "text-white/20 hover:bg-white/10")}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm("Eliminare questa voce dalla KB?")) deleteMutation.mutate(item.id); }}
                      className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
