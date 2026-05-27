import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import {
  Users, Search, Filter, ChevronRight, X, Send, KeyRound,
  BookOpen, Bell, StickyNote, Eye, Calendar, Mail, User, RefreshCw,
  CheckCircle, AlertCircle, Loader2, Plus, MessageSquare, BellRing, BellOff,
  Trash2, AlertTriangle, ShieldX, ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Account {
  id: number;
  name: string;
  firstName: string | null;
  lastName:  string | null;
  email:     string;
  role:      string;
  adminNotes: string | null;
  lastLoginAt: string | null;
  createdAt:  string;
  updatedAt:  string;
  codesCount: number;
  purchasesCount: number;
}

interface AccountDetail extends Account {
  codes: Array<{
    id: number; code: string; courseId: number; courseTitle: string;
    isActive: boolean; activatedAt: string | null; createdAt: string;
    assignedEmail: string | null; notes: string | null;
  }>;
  purchases: Array<{
    id: number; courseId: number; courseTitle: string;
    amountPaid: number; currency: string; status: string;
    accessCode: string | null; createdAt: string;
  }>;
  activeCourses: Array<{
    id: number; courseId: number; courseTitle: string;
    accessCodeId: number; accessCode: string | null;
    source: "stripe" | "code"; activatedAt: string; status: string;
  }>;
  notifications: Array<{
    id: number; type: string; title: string; message: string;
    isRead: boolean; createdAt: string;
  }>;
}

interface Course { id: number; title: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtFull(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function roleBadge(role: string) {
  if (role === "customer") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 font-semibold">CUSTOMER</span>;
  if (role === "student")  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20 font-semibold">STUDENT</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-semibold">{role.toUpperCase()}</span>;
}

// ─── FILTER TABS ──────────────────────────────────────────────────────────────

const FILTERS = [
  { key: "all",             label: "Tutti" },
  { key: "today",           label: "Oggi" },
  { key: "last7days",       label: "Ultimi 7 giorni" },
  { key: "with_courses",    label: "Con corsi" },
  { key: "without_courses", label: "Senza corsi" },
  { key: "with_codes",      label: "Con codici" },
  { key: "without_codes",   label: "Senza codici" },
];

// ─── ASSIGN CODE MODAL ────────────────────────────────────────────────────────

function AssignCodeModal({
  account, courses, onClose, onSuccess,
}: { account: Account; courses: Course[]; onClose: () => void; onSuccess: () => void }) {
  const [courseId, setCourseId] = useState("");
  const [notify, setNotify]     = useState(true);
  const [error, setError]       = useState("");
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => fetchApi(`/admin/accounts/${account.id}/assign-code`, {
      method: "POST",
      body: JSON.stringify({ courseId: parseInt(courseId), sendNotification: notify }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "accounts"] });
      qc.invalidateQueries({ queryKey: ["admin", "account", account.id] });
      onSuccess();
      onClose();
    },
    onError: (e: any) => setError(e?.message ?? "Errore"),
  });

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">Assegna Codice Corso</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
        </div>
        <p className="text-sm text-white/50 mb-4">
          Account: <span className="text-white font-medium">{account.email}</span>
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/60 uppercase tracking-wider block mb-1.5">Corso</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-primary/60 outline-none"
            >
              <option value="">— Seleziona corso —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="accent-primary w-4 h-4"
            />
            <span className="text-sm text-white/70">Invia notifica al cliente con il codice</span>
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={() => { if (!courseId) { setError("Seleziona un corso"); return; } mutate(); }}
              disabled={isPending || !courseId}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Genera e Assegna
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SEND MESSAGE MODAL ───────────────────────────────────────────────────────

function SendMessageModal({
  account, onClose, onSuccess,
}: { account: Account; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle]     = useState("");
  const [message, setMessage] = useState("");
  const [error, setError]     = useState("");
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => fetchApi(`/admin/accounts/${account.id}/message`, {
      method: "POST",
      body: JSON.stringify({ title, message }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "account", account.id] });
      onSuccess();
      onClose();
    },
    onError: (e: any) => setError(e?.message ?? "Errore"),
  });

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">Invia Messaggio</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
        </div>
        <p className="text-sm text-white/50 mb-4">
          Destinatario: <span className="text-white font-medium">{account.email}</span>
        </p>

        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Oggetto del messaggio..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-primary/60 outline-none"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Testo del messaggio..."
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-primary/60 outline-none resize-none"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={() => { if (!title.trim() || !message.trim()) { setError("Compila tutti i campi"); return; } mutate(); }}
              disabled={isPending}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Invia
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ACCOUNT DETAIL MODAL ────────────────────────────────────────────────────

function AccountDetailModal({
  accountId, courses, onClose,
}: { accountId: number; courses: Course[]; onClose: () => void }) {
  const [tab, setTab]               = useState<"info" | "corsi" | "codici" | "messaggi" | "note">("info");
  const [notes, setNotes]           = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showMsg, setShowMsg]       = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText]       = useState("");
  const qc = useQueryClient();

  const { data: detail, isLoading } = useQuery<AccountDetail>({
    queryKey: ["admin", "account", accountId],
    queryFn:  () => fetchApi(`/admin/accounts/${accountId}`),
  });

  const { data: pushStats } = useQuery<{ total: number; active: number }>({
    queryKey: ["admin", "account", accountId, "push"],
    queryFn:  () => fetchApi(`/admin/accounts/${accountId}/push-status`),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (detail?.adminNotes != null) setNotes(detail.adminNotes ?? "");
  }, [detail?.adminNotes]);

  const { mutate: saveNotes, isPending: savingNotes } = useMutation({
    mutationFn: () => fetchApi(`/admin/accounts/${accountId}/notes`, {
      method: "PUT",
      body: JSON.stringify({ adminNotes: notes }),
    }),
    onSuccess: () => {
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ["admin", "accounts"] });
    },
  });

  const { mutate: resendCode } = useMutation({
    mutationFn: (codeId: number) => fetchApi(`/admin/accounts/${accountId}/resend-code`, {
      method: "POST",
      body: JSON.stringify({ codeId }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "account", accountId] }),
  });

  const { mutate: deletePurchase, isPending: deletingPurchase } = useMutation({
    mutationFn: ({ purchaseId, revokeCode }: { purchaseId: number; revokeCode: boolean }) =>
      fetchApi(`/admin/accounts/${accountId}/purchases/${purchaseId}`, {
        method: "DELETE",
        body: JSON.stringify({ revokeCode }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "account", accountId] });
      qc.invalidateQueries({ queryKey: ["admin", "accounts"] });
    },
  });

  const { mutate: revokeAccessCode, isPending: revokingCode } = useMutation({
    mutationFn: (codeId: number) =>
      fetchApi(`/admin/accounts/${accountId}/access-codes/${codeId}`, {
        method: "DELETE",
        body: JSON.stringify({ hardDelete: false }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "account", accountId] }),
  });

  const { mutate: deleteAccessCode, isPending: deletingCode } = useMutation({
    mutationFn: (codeId: number) =>
      fetchApi(`/admin/access-codes/${codeId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "account", accountId] });
      qc.invalidateQueries({ queryKey: ["admin", "access-codes"] });
      console.log("[ADMIN DELETE] success — code removed from DB");
    },
    onError: (err: any) => {
      console.error("[ADMIN DELETE ERROR]", err.message);
      alert(`Errore eliminazione codice: ${err.message}`);
    },
  });

  const [removingCourseId, setRemovingCourseId] = useState<number | null>(null);
  const { mutate: removeActiveCourse } = useMutation({
    mutationFn: (accessId: number) => {
      console.log("[ADMIN COURSE REMOVE] requested — accessId:", accessId);
      return fetchApi(`/admin/accounts/${accountId}/active-courses/${accessId}`, { method: "DELETE" });
    },
    onSuccess: (_, accessId) => {
      console.log("[ADMIN COURSE REMOVE] confirmed — relation removed");
      qc.invalidateQueries({ queryKey: ["admin", "account", accountId] });
      qc.invalidateQueries({ queryKey: ["admin", "accounts"] });
      setRemovingCourseId(null);
      console.log("[ADMIN COURSE REMOVE] UI refreshed — cache invalidated");
    },
    onError: (err: any) => {
      console.error("[ADMIN COURSE REMOVE ERROR]", err.message);
      setRemovingCourseId(null);
      alert(`Errore rimozione corso: ${err.message}`);
    },
  });

  const { mutate: deleteAccount, isPending: deletingAccount } = useMutation({
    mutationFn: () => fetchApi(`/admin/accounts/${accountId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "accounts"] });
      onClose();
    },
  });

  const TABS = [
    { key: "info",      label: "Informazioni", icon: User },
    { key: "corsi",     label: "Corsi",        icon: BookOpen },
    { key: "codici",    label: "Codici",       icon: KeyRound },
    { key: "messaggi",  label: "Messaggi",     icon: MessageSquare },
    { key: "note",      label: "Note",         icon: StickyNote },
  ] as const;

  return (
    <div className="fixed inset-0 z-[9500] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-[#181818] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div>
            <p className="font-bold text-white">{detail?.name ?? "…"}</p>
            <p className="text-xs text-white/40">{detail?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAssign(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/20 transition-colors"
            >
              <KeyRound size={13} /> Assegna Codice
            </button>
            <button
              onClick={() => setShowMsg(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-colors"
            >
              <Send size={13} /> Messaggio
            </button>
            <button
              onClick={() => setConfirmDeleteAccount(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={13} /> Elimina Account
            </button>
            <button onClick={onClose} className="text-white/40 hover:text-white p-1 ml-1"><X size={20} /></button>
          </div>
        </div>

        {/* Mobile action buttons */}
        <div className="sm:hidden flex gap-2 px-5 py-3 border-b border-white/5 shrink-0">
          <button
            onClick={() => setShowAssign(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold"
          >
            <KeyRound size={13} /> Assegna Codice
          </button>
          <button
            onClick={() => setShowMsg(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold"
          >
            <Send size={13} /> Messaggio
          </button>
          <button
            onClick={() => setConfirmDeleteAccount(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 py-2 border-b border-white/8 overflow-x-auto scrollbar-none shrink-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                tab === key ? "bg-primary/15 text-primary border border-primary/20" : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-white/30" />
            </div>
          ) : !detail ? null : (
            <>
              {/* ── INFO ── */}
              {tab === "info" && (
                <div className="space-y-3">
                  {[
                    { label: "Nome completo", value: detail.name },
                    { label: "Email",         value: detail.email },
                    { label: "Ruolo",         value: roleBadge(detail.role) },
                    { label: "Registrato il", value: fmtFull(detail.createdAt) },
                    { label: "Ultimo accesso", value: detail.lastLoginAt ? fmtFull(detail.lastLoginAt) : "Non disponibile" },
                    { label: "Corsi attivi", value: `${(detail.activeCourses ?? []).length}` },
                    { label: "Codici assegnati", value: `${detail.codesCount}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between py-2 border-b border-white/5">
                      <span className="text-xs text-white/40 w-36 shrink-0">{label}</span>
                      <span className="text-sm text-white/90 text-right">{value}</span>
                    </div>
                  ))}

                  {/* Push status row */}
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-xs text-white/40 w-36 shrink-0">Push notifiche</span>
                    {pushStats == null ? (
                      <span className="text-xs text-white/20">…</span>
                    ) : pushStats.active > 0 ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-2.5 py-1">
                        <BellRing size={11} /> Attive ({pushStats.active} dispositiv{pushStats.active === 1 ? "o" : "i"})
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-white/30 bg-white/5 border border-white/8 rounded-lg px-2.5 py-1">
                        <BellOff size={11} /> Non attive
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ── CORSI ── */}
              {tab === "corsi" && (
                <div className="space-y-2">
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] text-white/30 uppercase tracking-wide font-semibold">
                      Corsi attivi ({(detail.activeCourses ?? []).length})
                    </p>
                  </div>

                  {(detail.activeCourses ?? []).length === 0 ? (
                    <p className="text-sm text-white/30 text-center py-8">Nessun corso attivo</p>
                  ) : (detail.activeCourses ?? []).map((ac) => (
                    <div key={ac.id} className="bg-white/5 rounded-xl p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white">{ac.courseTitle}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {/* Source badge */}
                            {ac.source === "stripe" ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-violet-500/15 text-violet-400 border border-violet-500/20">STRIPE</span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-primary/15 text-primary border border-primary/20">CODICE</span>
                            )}
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-green-500/15 text-green-400 border border-green-500/20">ATTIVO</span>
                            {ac.accessCode && (
                              <span className="text-xs text-white/40 font-mono bg-white/5 px-1.5 py-0.5 rounded">{ac.accessCode}</span>
                            )}
                            <span className="text-xs text-white/30">{fmt(ac.activatedAt)}</span>
                          </div>
                        </div>

                        {/* Remove course button */}
                        <button
                          disabled={removingCourseId === ac.id}
                          onClick={() => {
                            const studentName = detail.firstName
                              ? `${detail.firstName} ${detail.lastName ?? ""}`.trim()
                              : detail.name || detail.email;
                            if (confirm(
                              `Vuoi davvero rimuovere il corso "${ac.courseTitle}" dall'account di ${studentName}?\n\nIl corso non sarà più accessibile dal cliente.`
                            )) {
                              setRemovingCourseId(ac.id);
                              removeActiveCourse(ac.id);
                            }
                          }}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-colors disabled:opacity-40 text-xs font-semibold min-w-[100px] justify-center"
                        >
                          {removingCourseId === ac.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          {removingCourseId === ac.id ? "Rimozione..." : "Rimuovi corso"}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Acquisti Stripe separati (storico) — mostrati solo se ci sono */}
                  {detail.purchases.length > 0 && (
                    <details className="mt-4 group">
                      <summary className="text-[11px] text-white/25 cursor-pointer hover:text-white/50 transition-colors select-none uppercase tracking-wide font-semibold">
                        Storico acquisti Stripe ({detail.purchases.length})
                      </summary>
                      <div className="mt-2 space-y-2">
                        {detail.purchases.map((p) => (
                          <div key={p.id} className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white/70">{p.courseTitle}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold",
                                    p.status === "completed" ? "bg-green-500/10 text-green-500/70" : "bg-yellow-500/10 text-yellow-500/70"
                                  )}>{p.status.toUpperCase()}</span>
                                  <span className="text-xs text-white/30">€{p.amountPaid.toFixed(2)}</span>
                                  <span className="text-xs text-white/25">{fmt(p.createdAt)}</span>
                                </div>
                              </div>
                              <button
                                disabled={deletingPurchase}
                                onClick={() => {
                                  if (confirm(`Rimuovere l'acquisto di "${p.courseTitle}"?\n\nIl codice associato verrà revocato e l'accesso al corso rimosso.`)) {
                                    deletePurchase({ purchaseId: p.id, revokeCode: true });
                                  }
                                }}
                                className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-40"
                              >
                                <Trash2 size={11} /> Rimuovi
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* ── CODICI ── */}
              {tab === "codici" && (
                <div className="space-y-2">
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => setShowAssign(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/20 transition-colors"
                    >
                      <Plus size={13} /> Nuovo codice
                    </button>
                  </div>
                  {detail.codes.length === 0 ? (
                    <p className="text-sm text-white/30 text-center py-8">Nessun codice assegnato</p>
                  ) : detail.codes.map((c) => (
                    <div key={c.id} className="bg-white/5 rounded-xl p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{c.courseTitle}</p>
                          <p className="text-xs font-mono text-primary mt-0.5 tracking-widest">{c.code}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold",
                            c.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                          )}>{c.isActive ? "ATTIVO" : "REVOCATO"}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => resendCode(c.id)}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
                            >
                              <RefreshCw size={10} /> Reinvia
                            </button>
                            {c.isActive && (
                              <button
                                disabled={revokingCode || deletingCode}
                                onClick={() => {
                                  if (confirm(`Revocare il codice "${c.code}" per "${c.courseTitle}"?\nIl cliente perderà l'accesso al corso.`)) {
                                    revokeAccessCode(c.id);
                                  }
                                }}
                                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20 disabled:opacity-40"
                              >
                                <ShieldX size={10} /> Revoca
                              </button>
                            )}
                            <button
                              disabled={revokingCode || deletingCode}
                              onClick={() => {
                                if (confirm(`Eliminare DEFINITIVAMENTE il codice "${c.code}"?\n\nQuesta azione è irreversibile: il codice e l'accesso al corso verranno rimossi dal database.`)) {
                                  deleteAccessCode(c.id);
                                }
                              }}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-zinc-800 text-white/50 hover:bg-red-900/40 hover:text-red-400 transition-colors border border-white/10 disabled:opacity-40"
                            >
                              <Trash2 size={10} /> Elimina
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-2 text-[10px] text-white/30">
                        <span>Assegnato: {fmt(c.createdAt)}</span>
                        {c.activatedAt && <span>Attivato: {fmt(c.activatedAt)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── MESSAGGI ── */}
              {tab === "messaggi" && (
                <div className="space-y-2">
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => setShowMsg(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-colors"
                    >
                      <Plus size={13} /> Nuovo messaggio
                    </button>
                  </div>
                  {detail.notifications.length === 0 ? (
                    <p className="text-sm text-white/30 text-center py-8">Nessun messaggio inviato</p>
                  ) : detail.notifications.map((n) => (
                    <div key={n.id} className="bg-white/5 rounded-xl p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{n.title}</p>
                          <p className="text-xs text-white/50 mt-1 leading-relaxed">{n.message}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/40">{n.type}</span>
                          {n.isRead
                            ? <span className="text-[10px] text-green-400 flex items-center gap-0.5"><CheckCircle size={9} /> Letto</span>
                            : <span className="text-[10px] text-white/30 flex items-center gap-0.5"><AlertCircle size={9} /> Non letto</span>
                          }
                        </div>
                      </div>
                      <p className="text-[10px] text-white/25 mt-2">{fmtFull(n.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── NOTE ── */}
              {tab === "note" && (
                <div className="space-y-3">
                  <p className="text-xs text-white/40">Note interne — visibili solo all'admin</p>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Aggiungi note interne su questo account..."
                    rows={8}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:border-primary/60 outline-none resize-none"
                  />
                  <button
                    onClick={() => saveNotes()}
                    disabled={savingNotes}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {savingNotes ? <Loader2 size={15} className="animate-spin" /> : <StickyNote size={15} />}
                    {notesSaved ? "Salvato!" : "Salva Note"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAssign && detail && (
        <AssignCodeModal
          account={detail}
          courses={courses}
          onClose={() => setShowAssign(false)}
          onSuccess={() => {}}
        />
      )}
      {showMsg && detail && (
        <SendMessageModal
          account={detail}
          onClose={() => setShowMsg(false)}
          onSuccess={() => {}}
        />
      )}

      {/* ── DELETE ACCOUNT CONFIRMATION MODAL ── */}
      {confirmDeleteAccount && detail && (
        <div className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#181818] border border-red-500/30 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Elimina Account</h3>
                <p className="text-xs text-white/40">Questa azione è irreversibile</p>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-4 leading-relaxed">
              Stai per eliminare definitivamente l'account di{" "}
              <span className="font-bold text-white">{detail.email}</span>.<br />
              Verranno rimossi: sessioni, notifiche, chat, codici accesso e dati collegati.
            </p>
            <p className="text-xs text-white/40 mb-2">
              Digita <span className="font-mono text-red-400">ELIMINA</span> per confermare:
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="ELIMINA"
              className="w-full bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:border-red-500/50 outline-none mb-4 font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setConfirmDeleteAccount(false); setDeleteConfirmText(""); }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => { if (deleteConfirmText === "ELIMINA") deleteAccount(); }}
                disabled={deleteConfirmText !== "ELIMINA" || deletingAccount}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-40"
              >
                {deletingAccount ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Elimina Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ACCOUNT ROW ─────────────────────────────────────────────────────────────

function AccountRow({
  account, courses, onDetail,
}: { account: Account; courses: Course[]; onDetail: () => void }) {
  const [showAssign, setShowAssign] = useState(false);
  const [showMsg, setShowMsg]       = useState(false);
  const qc = useQueryClient();

  return (
    <>
      <div className="bg-card/50 border border-white/5 rounded-xl overflow-hidden hover:bg-card/80 transition-colors">

        {/* ── TOP: avatar + identità + stats ── */}
        <div className="flex items-start gap-3 p-4 pb-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-sm font-bold text-primary">{account.name.charAt(0).toUpperCase()}</span>
          </div>

          {/* Info block — solo testo, nessun pulsante qui */}
          <div className="flex-1 min-w-0">
            {/* Nome + badge ruolo */}
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-sm font-semibold text-white leading-tight">{account.name}</p>
              {roleBadge(account.role)}
            </div>
            {/* Email */}
            <p className="text-xs text-white/40 truncate mb-1.5">{account.email}</p>
            {/* Stats minimaliste */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] text-white/30">
                <BookOpen size={10} />
                {account.purchasesCount} {account.purchasesCount === 1 ? "corso" : "corsi"}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-white/30">
                <KeyRound size={10} />
                {account.codesCount} {account.codesCount === 1 ? "codice" : "codici"}
              </span>
              <span className="text-[11px] text-white/20">{fmt(account.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* ── BOTTOM: azioni in riga separata ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-white/5 bg-white/[0.02]">
          <button
            onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-green-500/10 text-xs text-white/40 hover:text-green-400 transition-colors"
          >
            <KeyRound size={12} />
            <span>Assegna</span>
          </button>
          <button
            onClick={() => setShowMsg(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-blue-500/10 text-xs text-white/40 hover:text-blue-400 transition-colors"
          >
            <Send size={12} />
            <span>Messaggio</span>
          </button>
          <button
            onClick={onDetail}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-xs text-primary transition-colors ml-auto font-semibold"
          >
            <Eye size={12} />
            Dettaglio
          </button>
        </div>
      </div>

      {showAssign && (
        <AssignCodeModal
          account={account}
          courses={courses}
          onClose={() => setShowAssign(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["admin", "accounts"] })}
        />
      )}
      {showMsg && (
        <SendMessageModal
          account={account}
          onClose={() => setShowMsg(false)}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AdminAccounts() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort,   setSort]   = useState("date_desc");
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/admin");
    }
  }, [user, authLoading, setLocation]);

  // Support ?userId=X navigation from push notifications — opens that account's detail
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("userId");
    if (uid) {
      setDetailId(parseInt(uid, 10));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data, isLoading } = useQuery<{ accounts: Account[]; total: number }>({
    queryKey: ["admin", "accounts", search, filter],
    queryFn:  () => fetchApi(`/admin/accounts?search=${encodeURIComponent(search)}&filter=${filter}`),
    refetchInterval: 60_000,
  });

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["admin", "courses"],
    queryFn:  () => fetchApi("/admin/courses"),
  });

  if (authLoading) return null;

  const accounts = [...(data?.accounts ?? [])].sort((a: any, b: any) => {
    if (sort === "date_desc")    return (b.id ?? 0) - (a.id ?? 0);
    if (sort === "date_asc")     return (a.id ?? 0) - (b.id ?? 0);
    if (sort === "name_az")      return (a.name || "").localeCompare(b.name || "", "it");
    if (sort === "name_za")      return (b.name || "").localeCompare(a.name || "", "it");
    if (sort === "email_az")     return (a.email || "").localeCompare(b.email || "", "it");
    if (sort === "courses_desc") return (b.purchasesCount ?? 0) - (a.purchasesCount ?? 0);
    return 0;
  });

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      <AdminSidebar />

      <main className="flex-1 w-0 min-w-0 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-12 overflow-x-hidden">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Users size={20} className="text-primary shrink-0" />
            <h1 className="text-xl md:text-3xl font-display font-bold text-white uppercase tracking-wider leading-tight">
              Account Registrati
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Tutti gli account creati sul sito IUSMK
          </p>
        </div>

        {/* ── Stats bar: 3 colonne sempre, padding ridotto su mobile ── */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: "Totale",      value: data?.total ?? "—", color: "text-white" },
            { label: "Con corsi",   value: accounts.filter((a) => a.purchasesCount > 0).length, color: "text-green-400" },
            { label: "Con codici",  value: accounts.filter((a) => a.codesCount > 0).length, color: "text-blue-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card/50 border border-white/5 rounded-xl p-2.5 md:p-4 text-center">
              <p className={cn("text-xl md:text-2xl font-bold tabular-nums", color)}>{value}</p>
              <p className="text-[10px] md:text-xs text-white/40 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Ricerca ── */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, email…"
            className="w-full pl-9 pr-9 py-2.5 bg-card/60 border border-white/8 rounded-xl text-sm text-white placeholder-white/30 focus:border-primary/40 outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Filtri: scrollabili orizzontalmente, non sforano ── */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 md:mx-0 md:px-0">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0",
                filter === key
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10 border border-transparent"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Ordinamento + conteggio ── */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <p className="text-xs text-white/30 shrink-0">
            {isLoading ? "Caricamento…" : `${accounts.length} account`}
          </p>
          <div className="flex items-center gap-1.5 min-w-0">
            <ArrowUpDown size={12} className="text-white/30 shrink-0" />
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="bg-card/60 border border-white/8 text-white text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-primary/40 min-w-0 max-w-[160px] md:max-w-none"
            >
              <option value="date_desc">Più recenti</option>
              <option value="date_asc">Più vecchi</option>
              <option value="name_az">Nome A→Z</option>
              <option value="name_za">Nome Z→A</option>
              <option value="email_az">Email A→Z</option>
              <option value="courses_desc">Più corsi</option>
            </select>
          </div>
        </div>

        {/* ── Lista ── */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 bg-card/30 rounded-xl animate-pulse border border-white/5" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-16">
            <Users size={40} className="mx-auto text-white/10 mb-3" />
            <p className="text-white/30 text-sm">
              {search || filter !== "all" ? "Nessun account trovato per i filtri applicati" : "Nessun account registrato"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                courses={courses}
                onDetail={() => setDetailId(account.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Detail modal */}
      {detailId !== null && (
        <AccountDetailModal
          accountId={detailId}
          courses={courses}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
