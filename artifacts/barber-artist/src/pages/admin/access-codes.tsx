import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import {
  useAdminAccessCodes, useCreateAccessCode, useRevokeAccessCode,
  useReactivateAccessCode, useUpdateAccessCode, useDeleteAccessCode,
  useAdminAccountSearch, useNotifyAccessCode,
} from "@/hooks/use-admin";
import { useAdminCourses } from "@/hooks/use-admin";
import {
  Plus, Ban, Check, X, Copy, ChevronDown, ChevronUp, Pencil, RefreshCw,
  Trash2, Search, User, CalendarX, Bell, BellOff, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── CustomerSelector ─────────────────────────────────────────────────────────

interface CustomerSelectorProps {
  value: { id: number; name: string; email: string } | null;
  onChange: (c: { id: number; name: string; email: string } | null) => void;
}

function CustomerSelector({ value, onChange }: CustomerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: accounts = [] } = useAdminAccountSearch(search);

  // Chiude il dropdown cliccando fuori
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (acc: { id: number; name: string; email: string }) => {
    onChange(acc);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={open ? () => setOpen(false) : handleOpen}
        className={`w-full flex items-center justify-between gap-2 bg-background border text-sm px-3 py-2.5 rounded-lg transition-colors text-left ${
          open ? "border-primary/60" : "border-white/10 hover:border-white/20"
        }`}
      >
        {value ? (
          <span className="flex-1 min-w-0">
            <span className="text-white font-medium truncate block">{value.name}</span>
            <span className="text-muted-foreground text-xs truncate block">{value.email}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/60 flex items-center gap-2">
            <User className="w-4 h-4 shrink-0" />
            Seleziona account cliente...
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-card border border-white/15 rounded-xl shadow-2xl overflow-hidden">
          {/* Search bar */}
          <div className="p-2 border-b border-white/10">
            <div className="flex items-center gap-2 bg-background border border-white/10 rounded-lg px-3 py-2">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per nome o email..."
                className="flex-1 bg-transparent text-sm text-white placeholder-muted-foreground/50 outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-muted-foreground hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Account list */}
          <div className="overflow-y-auto max-h-52 overscroll-contain">
            {accounts.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                Nessun account trovato
              </div>
            ) : (
              accounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(acc); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${
                    value?.id === acc.id ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-xs font-bold text-white uppercase">
                    {acc.name?.charAt(0) || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white font-medium truncate">{acc.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{acc.email}</div>
                  </div>
                  {value?.id === acc.id && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ExpiresAtField ───────────────────────────────────────────────────────────

function ExpiresAtField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          title="Rimuovi scadenza"
          className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border border-white/10 text-muted-foreground hover:text-white hover:border-white/20 hover:bg-white/5 transition-colors"
        >
          <CalendarX className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({ code, courses, onClose, onSave }: { code: any; courses: any[]; onClose: () => void; onSave: (id: number, data: any) => void }) {
  const [form, setForm] = useState({
    courseId: String(code.courseId),
    assignedName: code.assignedName || "",
    assignedEmail: code.assignedEmail || "",
    maxDevices: String(code.maxDevices ?? 1),
    isActive: code.isActive,
    expiresAt: code.expiresAt ? new Date(code.expiresAt).toISOString().slice(0, 16) : "",
    notes: code.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(code.id, {
      courseId: form.courseId,
      assignedName: form.assignedName,
      assignedEmail: form.assignedEmail,
      maxDevices: form.maxDevices,
      isActive: form.isActive,
      expiresAt: form.expiresAt || null,
      notes: form.notes,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-white/10 rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg shadow-2xl overflow-y-auto max-h-[95vh]">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-white font-bold uppercase tracking-widest text-sm">Modifica Codice</h2>
            <code className="text-primary text-xs font-mono mt-0.5 block">{code.code}</code>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Corso</label>
            <select
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg"
            >
              <option value="">Seleziona corso...</option>
              {courses?.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Nome Cliente</label>
            <input
              value={form.assignedName}
              onChange={(e) => setForm({ ...form, assignedName: e.target.value })}
              className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg"
              placeholder="Mario Rossi"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Email Cliente</label>
            <input
              type="email"
              value={form.assignedEmail}
              onChange={(e) => setForm({ ...form, assignedEmail: e.target.value })}
              className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg"
              placeholder="mario@email.com"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Max Dispositivi</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="10"
                value={form.maxDevices}
                onChange={(e) => setForm({ ...form, maxDevices: e.target.value })}
                className="w-24 bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg"
              />
              <span className="text-xs text-muted-foreground">dispositivo/i autorizzati per questo codice</span>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-1">Dispositivi usati: {code.devicesUsed ?? 0}</p>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Stato</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, isActive: true })}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.isActive ? "bg-green-500/15 border-green-500/40 text-green-400" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}
              >
                ✓ Attivo
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, isActive: false })}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${!form.isActive ? "bg-red-500/15 border-red-500/40 text-red-400" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}
              >
                ✗ Revocato
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">
              Scadenza (opzionale)
            </label>
            <ExpiresAtField value={form.expiresAt} onChange={(v) => setForm({ ...form, expiresAt: v })} />
            {!form.expiresAt && (
              <p className="text-xs text-muted-foreground/50 mt-1">Nessuna scadenza — il codice non scadrà mai</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Note Interne</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg resize-none"
              placeholder="Note private visibili solo all'admin..."
            />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-white/10">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary text-white py-3 rounded-lg text-sm font-bold uppercase tracking-widest hover:bg-primary/80 transition-colors disabled:opacity-50"
          >
            {saving ? "Salvataggio..." : "Salva Modifiche"}
          </button>
          <button
            onClick={onClose}
            className="px-5 border border-white/10 text-white rounded-lg text-sm hover:bg-white/5 transition-colors"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CodeCard ─────────────────────────────────────────────────────────────────

function CodeCard({ code, courses, onRevoke, onReactivate, onEdit, onDelete, onNotify }: {
  code: any;
  courses: any[];
  onRevoke: (id: number) => void;
  onReactivate: (id: number) => void;
  onEdit: (code: any) => void;
  onDelete: (id: number) => void;
  onNotify: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notifySending, setNotifySending] = useState(false);
  const [localSentAt, setLocalSentAt] = useState<string | null>(code.notificationSentAt || null);
  const [localSentCount, setLocalSentCount] = useState<number>(code.notificationSentCount ?? 0);
  const { toast } = useToast();

  const copyCode = () => {
    navigator.clipboard.writeText(code.code);
    toast({ title: "Copiato!", description: "Codice copiato negli appunti." });
  };

  const handleNotify = async () => {
    setNotifySending(true);
    try {
      const data = await (await fetch(`/api/admin/access-codes/${code.id}/notify`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("barber_artist_token")}` },
      })).json();
      if (data.success) {
        setLocalSentAt(data.sentAt);
        setLocalSentCount(data.sendCount);
        toast({ title: "✓ Notifica inviata", description: `Inviata alle ${new Date(data.sentAt).toLocaleTimeString("it-IT")}` });
      } else {
        toast({ title: "Errore", description: data.message || "Impossibile inviare", variant: "destructive" });
      }
    } catch {
      toast({ title: "Errore", description: "Errore di rete", variant: "destructive" });
    }
    setNotifySending(false);
  };

  return (
    <div className={`border rounded-xl p-4 space-y-3 ${code.isActive ? "bg-card border-white/10" : "bg-card/40 border-white/5 opacity-70"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <code className="text-lg font-mono font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-lg tracking-widest">{code.code}</code>
          <button onClick={copyCode} className="text-muted-foreground hover:text-white transition-colors p-1.5 rounded hover:bg-white/10" title="Copia codice">
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${code.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
            {code.isActive ? <><Check className="w-3 h-3"/>Attivo</> : <><X className="w-3 h-3"/>Revocato</>}
          </span>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-muted-foreground hover:text-white transition-colors p-1.5 rounded hover:bg-white/10"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <div className="text-white font-semibold text-sm">{code.assignedName || "—"}</div>
        <div className="text-muted-foreground text-xs mt-0.5">{code.assignedEmail || "—"}</div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-primary/80 font-medium truncate">{code.courseTitle}</div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Notification status badge */}
          {localSentAt ? (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium" title={`Inviata ${localSentCount}× — ultima: ${new Date(localSentAt).toLocaleString("it-IT")}`}>
              <Bell className="w-3 h-3" />{localSentCount}×
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs bg-white/5 text-muted-foreground px-2 py-0.5 rounded-full font-medium">
              <BellOff className="w-3 h-3" />
            </span>
          )}
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${(code.devicesUsed ?? 0) >= (code.maxDevices ?? 1) ? "bg-red-500/15 text-red-400" : "bg-white/5 text-muted-foreground"}`}>
            {code.devicesUsed ?? 0}/{code.maxDevices ?? 1}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 pt-3 space-y-2.5">
          {code.boundUserEmail && code.boundUserEmail !== code.assignedEmail && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Email attivazione:</span>
              <span className="text-white truncate ml-2 max-w-[160px]">{code.boundUserEmail}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Dispositivi:</span>
            <span className="text-white">{code.devicesUsed ?? 0} / {code.maxDevices ?? 1}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Scadenza:</span>
            <span className="text-white">{code.expiresAt ? new Date(code.expiresAt).toLocaleString("it-IT") : "Mai"}</span>
          </div>
          {/* Notification status */}
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Notifica:</span>
            <span className={localSentAt ? "text-blue-400" : "text-muted-foreground/60"}>
              {localSentAt
                ? `Inviata ${localSentCount}× — ultima ${new Date(localSentAt).toLocaleString("it-IT")}`
                : "Non ancora inviata"}
            </span>
          </div>
          {code.notes && (
            <div className="text-xs text-muted-foreground bg-white/5 rounded p-2 italic">{code.notes}</div>
          )}

          {/* Notify button */}
          <button
            onClick={handleNotify}
            disabled={notifySending}
            className="w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-lg border border-blue-500/20 text-blue-400 hover:bg-blue-500/10 transition-colors font-medium disabled:opacity-50"
          >
            {notifySending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Invio in corso...</>
              : <><Bell className="w-3.5 h-3.5" /> {localSentAt ? "Reinvia notifica al cliente" : "Invia notifica al cliente"}</>
            }
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => onEdit(code)}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-lg border border-white/15 text-white hover:bg-white/10 transition-colors font-medium"
            >
              <Pencil className="w-3.5 h-3.5" /> Modifica
            </button>
            {code.isActive ? (
              <button
                onClick={() => { if (confirm("Revocare questo codice? Il codice verrà disattivato ma non rimosso.")) onRevoke(code.id); }}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors font-medium"
              >
                <Ban className="w-3.5 h-3.5" /> Revoca
              </button>
            ) : (
              <button
                onClick={() => onReactivate(code.id)}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-lg border border-green-500/20 text-green-400 hover:bg-green-500/10 transition-colors font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Riattiva
              </button>
            )}
          </div>
          <button
            onClick={() => {
              if (confirm(`Eliminare definitivamente il codice ${code.code}?\n\nQuesta azione è irreversibile: il codice sarà rimosso dal sistema e non potrà più essere utilizzato.`)) {
                onDelete(code.id);
              }
            }}
            className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-red-900/40 text-red-500 hover:bg-red-900/20 transition-colors font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" /> Elimina definitivamente
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  courseId: "",
  selectedAccount: null as { id: number; name: string; email: string } | null,
  maxDevices: "1",
  expiresAt: "",
  notes: "",
};

export default function AdminAccessCodes() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { data: codes, isLoading, refetch } = useAdminAccessCodes();
  const { data: courses } = useAdminCourses();
  const { mutate: createCode, isPending: isCreating, error: createError } = useCreateAccessCode();
  const { mutate: revokeCode } = useRevokeAccessCode();
  const { mutate: reactivateCode } = useReactivateAccessCode();
  const { mutateAsync: updateCode } = useUpdateAccessCode();
  const { mutate: deleteCode } = useDeleteAccessCode();

  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("all");
  const [usageFilter, setUsage]     = useState("all");
  const [courseFilter, setCourse]   = useState("all");
  const [sort, setSort]             = useState("date_desc");

  const filteredCodes = Array.isArray(codes)
    ? [...codes]
        .filter((c: any) => {
          const q = search.toLowerCase();
          const matchSearch = !q || (
            c.code?.toLowerCase().includes(q) ||
            c.courseTitle?.toLowerCase().includes(q) ||
            c.assignedName?.toLowerCase().includes(q) ||
            c.assignedEmail?.toLowerCase().includes(q) ||
            (c.boundUserEmail || "").toLowerCase().includes(q)
          );
          if (!matchSearch) return false;
          if (statusFilter === "active"  && !c.isActive) return false;
          if (statusFilter === "revoked" && c.isActive)  return false;
          const used = (c.devicesUsed ?? 0) > 0;
          if (usageFilter === "used"   && !used) return false;
          if (usageFilter === "unused" && used)  return false;
          if (courseFilter !== "all" && String(c.courseId) !== courseFilter) return false;
          return true;
        })
        .sort((a: any, b: any) => {
          if (sort === "date_desc")  return (b.id ?? 0) - (a.id ?? 0);
          if (sort === "date_asc")   return (a.id ?? 0) - (b.id ?? 0);
          if (sort === "name_az")    return (a.assignedName || "").localeCompare(b.assignedName || "", "it");
          if (sort === "name_za")    return (b.assignedName || "").localeCompare(a.assignedName || "", "it");
          if (sort === "course_az")  return (a.courseTitle || "").localeCompare(b.courseTitle || "", "it");
          return 0;
        })
    : [];

  const hasActiveFilters = search || statusFilter !== "all" || usageFilter !== "all" || courseFilter !== "all" || sort !== "date_desc";
  const resetFilters = () => { setSearch(""); setStatus("all"); setUsage("all"); setCourse("all"); setSort("date_desc"); };
  const courseOptions = Array.isArray(codes) ? Array.from(new Map(codes.map((c: any) => [String(c.courseId), c.courseTitle])).entries()) : [];

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/admin");
    }
  }, [user, authLoading, setLocation]);

  if (authLoading) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!form.courseId) { setFormError("Seleziona un corso."); return; }
    if (!form.selectedAccount) { setFormError("Seleziona un account cliente."); return; }

    createCode(
      {
        courseId: parseInt(form.courseId),
        userId: form.selectedAccount.id,
        assignedName: form.selectedAccount.name,
        assignedEmail: form.selectedAccount.email,
        maxDevices: parseInt(form.maxDevices),
        expiresAt: form.expiresAt || undefined,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          refetch();
          setForm(EMPTY_FORM);
        },
        onError: (err: any) => {
          setFormError(err?.message || "Errore nella creazione del codice");
        },
      }
    );
  };

  const handleUpdate = async (id: number, data: any) => {
    await updateCode({ id, data });
    refetch();
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      {editingCode && (
        <EditModal
          code={editingCode}
          courses={courses || []}
          onClose={() => setEditingCode(null)}
          onSave={handleUpdate}
        />
      )}

      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wider">
              Codici di Accesso
            </h1>
            <p className="text-muted-foreground text-xs mt-0.5">Codici a 6 cifre — un corso per codice</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setFormError(""); setForm(EMPTY_FORM); }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-primary/80 transition-colors rounded-lg"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Genera Codice</span>
            <span className="sm:hidden">Genera</span>
          </button>
        </div>

        {/* ── Genera Nuovo Codice Form ── */}
        {showForm && (
          <form onSubmit={handleCreate} className="bg-card/50 border border-white/10 p-5 mb-6 space-y-4 rounded-xl">
            <h2 className="text-white font-bold uppercase text-sm tracking-widest flex items-center gap-2">
              Genera Nuovo Codice
            </h2>
            {formError && (
              <div className="bg-red-500/15 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Corso */}
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Corso *</label>
                <select
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                  required
                  className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg"
                >
                  <option value="">Seleziona corso...</option>
                  {courses?.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>

              {/* Account cliente — selettore con ricerca */}
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">
                  Account Cliente *
                </label>
                <CustomerSelector
                  value={form.selectedAccount}
                  onChange={(acc) => setForm({ ...form, selectedAccount: acc })}
                />
                {form.selectedAccount && (
                  <p className="text-xs text-green-400/70 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Codice assegnato a {form.selectedAccount.name} ({form.selectedAccount.email})
                  </p>
                )}
              </div>

              {/* Max dispositivi */}
              <div>
                <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Max Dispositivi</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={form.maxDevices}
                  onChange={(e) => setForm({ ...form, maxDevices: e.target.value })}
                  className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg"
                />
              </div>

              {/* Data scadenza con pulsante X */}
              <div>
                <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">
                  Scade il (Opzionale)
                </label>
                <ExpiresAtField
                  value={form.expiresAt}
                  onChange={(v) => setForm({ ...form, expiresAt: v })}
                />
                {!form.expiresAt && (
                  <p className="text-xs text-muted-foreground/50 mt-1">Nessuna scadenza</p>
                )}
              </div>

              {/* Note */}
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Note Interne</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-background border border-white/10 text-white px-3 py-2.5 text-sm rounded-lg"
                  placeholder="Note private visibili solo all'admin..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={isCreating}
                className="bg-primary text-white px-6 py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-primary/80 transition-colors rounded-lg disabled:opacity-50"
              >
                {isCreating ? "Generando..." : "Genera"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(""); setForm(EMPTY_FORM); }}
                className="border border-white/10 text-white px-5 py-2.5 text-sm rounded-lg hover:bg-white/5 transition-colors"
              >
                Annulla
              </button>
            </div>
          </form>
        )}

        {/* Stats */}
        {!isLoading && Array.isArray(codes) && codes.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-5">
            {[
              { label: "Totale",   value: codes.length,                                             color: "text-white" },
              { label: "Attivi",   value: codes.filter((c: any) => c.isActive).length,              color: "text-green-400" },
              { label: "Revocati", value: codes.filter((c: any) => !c.isActive).length,             color: "text-red-400" },
              { label: "In uso",   value: codes.filter((c: any) => (c.devicesUsed ?? 0) > 0).length, color: "text-primary" },
              { label: "Filtrati", value: filteredCodes.length,                                      color: "text-white/60" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-card border border-white/5 rounded-xl p-3 text-center">
                <div className={`text-xl font-bold font-display ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-card/50 border border-white/10 rounded-xl p-4 mb-5 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca codice, cliente, email, corso..."
              className="flex-1 bg-transparent text-sm text-white placeholder-muted-foreground/50 outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select value={statusFilter} onChange={(e) => setStatus(e.target.value)} className="bg-background border border-white/10 text-xs text-white px-2 py-2 rounded-lg">
              <option value="all">Tutti gli stati</option>
              <option value="active">Solo attivi</option>
              <option value="revoked">Solo revocati</option>
            </select>
            <select value={usageFilter} onChange={(e) => setUsage(e.target.value)} className="bg-background border border-white/10 text-xs text-white px-2 py-2 rounded-lg">
              <option value="all">Tutti gli usi</option>
              <option value="used">Utilizzati</option>
              <option value="unused">Non utilizzati</option>
            </select>
            <select value={courseFilter} onChange={(e) => setCourse(e.target.value)} className="bg-background border border-white/10 text-xs text-white px-2 py-2 rounded-lg">
              <option value="all">Tutti i corsi</option>
              {courseOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-background border border-white/10 text-xs text-white px-2 py-2 rounded-lg">
              <option value="date_desc">Più recenti</option>
              <option value="date_asc">Più vecchi</option>
              <option value="name_az">Nome A→Z</option>
              <option value="name_za">Nome Z→A</option>
              <option value="course_az">Corso A→Z</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="text-xs text-primary/70 hover:text-primary transition-colors">
              Azzera filtri
            </button>
          )}
        </div>

        {/* Code list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Caricamento...</div>
        ) : filteredCodes.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/10 rounded-xl">
            <p className="text-muted-foreground text-sm">
              {search || hasActiveFilters ? "Nessun codice corrisponde ai filtri" : "Nessun codice generato"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCodes.map((code: any) => (
              <CodeCard
                key={code.id}
                code={code}
                courses={courses || []}
                onRevoke={(id) => revokeCode(id, { onSuccess: refetch })}
                onReactivate={(id) => reactivateCode(id, { onSuccess: refetch })}
                onEdit={setEditingCode}
                onDelete={(id) => deleteCode(id, { onSuccess: refetch })}
                onNotify={(id) => {}}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
