import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  Bell, ShoppingCart, CheckCheck, MessageSquare,
  ExternalLink, Send, Loader2, X, ArrowRight,
  Info, AlertCircle, Trash2, BellRing, BellOff,
  Settings, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/use-push-notifications";

// ─── Notification preferences ────────────────────────────────────────────────

const PREF_CATEGORIES = [
  { key: "chat",      label: "Chat clienti",        types: ["chat_message", "chat_reopen_request"] },
  { key: "contacts",  label: "Richieste di contatto", types: ["contact_request"] },
  { key: "purchases", label: "Acquisti",             types: ["purchase", "order_update"] },
  { key: "codes",     label: "Codici di accesso",   types: ["course_code_assigned", "code_resent"] },
  { key: "accounts",  label: "Nuovi account",        types: ["account_update", "new_registration"] },
  { key: "promos",    label: "Promozioni / Broadcast", types: ["promo_notification", "broadcast", "admin_notification", "private_message"] },
  { key: "system",    label: "Sistema / Altro",      types: [] }, // catch-all
] as const;

const PREF_STORAGE_KEY = "iusmk_admin_notif_prefs";

function loadPrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(PREF_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return Object.fromEntries(PREF_CATEGORIES.map((c) => [c.key, true]));
}

function savePrefs(prefs: Record<string, boolean>) {
  localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify(prefs));
  console.log("[NOTIFICATIONS] preferenze salvate:", prefs);
}

function matchesPrefCategory(type: string): string {
  for (const cat of PREF_CATEGORIES) {
    if (cat.key === "system") continue;
    if ((cat.types as readonly string[]).includes(type)) return cat.key;
  }
  return "system";
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface NotifMetadata {
  conversationId?: number;
  senderId?:       number;
  senderName?:     string;
  senderEmail?:    string;
}

interface Notification {
  id:       number;
  type:     string;
  title:    string;
  message:  string;
  isRead:   boolean;
  metadata: string | null;
  userId:   number | null;
  createdAt: string;
}

// ─── Quick Reply Modal ────────────────────────────────────────────────────────

function QuickReplyModal({
  notification,
  meta,
  onClose,
}: {
  notification: Notification;
  meta:         NotifMetadata;
  onClose:      () => void;
}) {
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { mutate: sendReply, isPending } = useMutation({
    mutationFn: () => fetchApi(`/admin/chat/${meta.conversationId}/reply`, {
      method: "POST",
      body: JSON.stringify({ content: text.trim() }),
    }),
    onSuccess: async () => {
      await fetchApi(`/admin/notifications/${notification.id}/read`, { method: "PUT" });
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
      qc.invalidateQueries({ queryKey: ["admin", "chat", "conversations"] });
      toast({ title: "Risposta inviata", description: `Messaggio inviato a ${meta.senderName}.` });
      onClose();
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile inviare il messaggio.", variant: "destructive" });
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">
                {(meta.senderName ?? "U").charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-white">{meta.senderName}</p>
              <p className="text-xs text-white/40">{meta.senderEmail}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>
        <div className="mx-5 mt-4 bg-white/4 border border-white/8 rounded-xl px-4 py-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Messaggio ricevuto</p>
          <p className="text-sm text-white/70 leading-relaxed">{notification.message}</p>
        </div>
        <div className="p-5 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) sendReply(); } }}
            placeholder="Scrivi la tua risposta…"
            rows={3}
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-primary/40 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={() => sendReply()}
              disabled={!text.trim() || isPending}
              className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/80 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Invia risposta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete All Modal ─────────────────────────────────────────────────

function ConfirmDeleteAllModal({ onConfirm, onCancel, isPending }: {
  onConfirm: () => void;
  onCancel:  () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-white font-semibold text-sm mb-1">Elimina tutte le notifiche?</p>
        <p className="text-white/40 text-xs mb-5">Questa azione non può essere annullata.</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white transition-colors">
            Annulla
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Conferma
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notification Card ────────────────────────────────────────────────────────

function NotifCard({
  n,
  onMarkRead,
  onOpenConv,
  onOpenContact,
  onReply,
  onDelete,
}: {
  n:             Notification;
  onMarkRead:    (id: number) => void;
  onOpenConv:    (convId: number) => void;
  onOpenContact: (contactId: number) => void;
  onReply:       (n: Notification, meta: NotifMetadata) => void;
  onDelete:      (id: number) => void;
}) {
  const isChatMsg    = n.type === "chat_message";
  const isReopenReq  = n.type === "chat_reopen_request";
  const isChat       = isChatMsg || isReopenReq;
  const isContact    = n.type === "contact_request";
  const meta: NotifMetadata = (() => {
    try { return n.metadata ? JSON.parse(n.metadata) : {}; } catch { return {}; }
  })();
  const hasConv    = isChat    && !!meta.conversationId;
  const hasContact = isContact && !!(meta as any).contactId;

  function fmtDate(d: string) {
    const date = new Date(d);
    return date.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className={cn(
      "bg-card border rounded-xl transition-all duration-200",
      !n.isRead
        ? isChat
          ? "border-primary/30 bg-primary/5"
          : "border-white/15 bg-white/3"
        : "border-white/5 opacity-60"
    )}>
      <div className="p-4 md:p-5">
        <div className="flex items-start gap-3 md:gap-4">
          {/* Icon */}
          <div className={cn(
            "p-2 rounded-lg shrink-0 mt-0.5",
            isChat      ? "bg-primary/15"       :
            isContact   ? "bg-amber-500/10"     :
            n.type === "purchase" ? "bg-green-500/10" :
            "bg-blue-500/10"
          )}>
            {isChat ? (
              <MessageSquare size={16} className="text-primary" />
            ) : isContact ? (
              <Info size={16} className="text-amber-400" />
            ) : n.type === "purchase" ? (
              <ShoppingCart size={16} className="text-green-400" />
            ) : (
              <Bell size={16} className="text-blue-400" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-sm text-white leading-snug">{n.title}</h3>
              <div className="flex items-center gap-2 shrink-0">
                {!n.isRead && (
                  <button
                    onClick={() => onMarkRead(n.id)}
                    className="text-[11px] text-white/40 hover:text-white transition-colors whitespace-nowrap flex items-center gap-1"
                  >
                    <CheckCheck size={12} /> Letta
                  </button>
                )}
                <button
                  onClick={() => onDelete(n.id)}
                  className="text-white/20 hover:text-red-400 transition-colors p-0.5"
                  title="Elimina"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <p className="text-sm text-white/50 mt-1 leading-relaxed">{n.message}</p>

            {isChat && meta.senderName && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px] text-white/30">da</span>
                <span className="text-[11px] font-semibold text-white/60">{meta.senderName}</span>
                {meta.senderEmail && (
                  <span className="text-[11px] text-white/25">· {meta.senderEmail}</span>
                )}
              </div>
            )}

            <p className="text-xs text-white/25 mt-2">{fmtDate(n.createdAt)}</p>

            {hasConv && (
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => { onMarkRead(n.id); onOpenConv(meta.conversationId!); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/80 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  <ArrowRight size={12} /> Apri chat
                </button>
                {isChatMsg && (
                  <button
                    onClick={() => onReply(n, meta)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 hover:border-white/30 text-white/60 hover:text-white font-semibold text-xs rounded-lg transition-colors"
                  >
                    <Send size={12} /> Risposta rapida
                  </button>
                )}
              </div>
            )}

            {hasContact && (
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => onOpenContact((meta as any).contactId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  <ArrowRight size={12} /> Apri richiesta
                </button>
                {!n.isRead && (
                  <button
                    onClick={() => onMarkRead(n.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 hover:border-white/30 text-white/60 hover:text-white font-semibold text-xs rounded-lg transition-colors"
                  >
                    Segna come letta
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminNotifications() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [replyModal, setReplyModal] = useState<{ notif: Notification; meta: NotifMetadata } | null>(null);
  const [filterType, setFilterType] = useState<"all" | "chat_message" | "contact_request" | "other">("all");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(loadPrefs);
  const [prefsOpen, setPrefsOpen] = useState(false);

  function togglePref(key: string) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    savePrefs(updated);
  }

  const { status: pushStatus, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications("admin");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [user, authLoading, setLocation]);

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["admin", "notifications"],
    queryFn:  () => fetchApi<Notification[]>("/admin/notifications"),
    refetchInterval: 15_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/notifications/${id}/read`, { method: "PUT" }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["admin", "notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = visible.filter((n) => !n.isRead);
      await Promise.all(unread.map((n) => fetchApi(`/admin/notifications/${n.id}/read`, { method: "PUT" })));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
      toast({ title: "Aggiornate", description: "Tutte le notifiche visibili segnate come lette." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/notifications/${id}`, { method: "DELETE" }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
      qc.invalidateQueries({ queryKey: ["admin", "notifications", "unread-count"] });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => fetchApi("/admin/notifications", { method: "DELETE" }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
      qc.invalidateQueries({ queryKey: ["admin", "notifications", "unread-count"] });
      setConfirmDeleteAll(false);
      toast({ title: "Eliminate", description: "Tutte le notifiche sono state eliminate." });
    },
  });

  function openConversation(convId: number) { setLocation(`/admin/chat?conv=${convId}`); }
  function openContactRequest(contactId: number) { setLocation(`/admin/contacts?id=${contactId}`); }

  if (authLoading) return null;

  const prefFiltered = notifications.filter((n) => {
    const cat = matchesPrefCategory(n.type);
    return prefs[cat] !== false;
  });

  const visible = prefFiltered.filter((n) => {
    if (filterType === "chat_message")    return n.type === "chat_message";
    if (filterType === "contact_request") return n.type === "contact_request";
    if (filterType === "other")           return n.type !== "chat_message" && n.type !== "contact_request";
    return true;
  });

  const unreadCount        = notifications.filter((n) => !n.isRead).length;
  const chatCount          = notifications.filter((n) => n.type === "chat_message").length;
  const contactCount       = notifications.filter((n) => n.type === "contact_request").length;
  const unreadChatCount    = notifications.filter((n) => n.type === "chat_message" && !n.isRead).length;
  const unreadContactCount = notifications.filter((n) => n.type === "contact_request" && !n.isRead).length;

  return (
    <div className="flex min-h-screen bg-background text-white">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Notifiche
                {unreadCount > 0 && (
                  <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    {unreadCount}
                  </span>
                )}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Acquisti, messaggi e notifiche di sistema
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {/* Compact push status */}
              {pushStatus === "subscribed" ? (
                <button
                  onClick={pushUnsubscribe}
                  className="flex items-center gap-1.5 text-xs text-green-400 border border-green-500/20 bg-green-500/8 hover:bg-green-500/15 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <BellRing size={12} /> Push attive
                </button>
              ) : pushStatus === "unsubscribed" ? (
                <button
                  onClick={pushSubscribe}
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Bell size={12} /> Attiva push
                </button>
              ) : null}
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors"
                >
                  <CheckCheck size={16} /> Segna tutte lette
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 border border-transparent hover:border-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Trash2 size={12} /> Elimina tutte
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2 mb-5">
            {([
              { key: "all",             label: "Tutte",     count: notifications.length },
              { key: "chat_message",    label: "Messaggi",  count: chatCount,    badge: unreadChatCount },
              { key: "contact_request", label: "Richieste", count: contactCount, badge: unreadContactCount },
              { key: "other",           label: "Sistema",   count: notifications.length - chatCount - contactCount },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  filterType === tab.key
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-white/5 text-white/50 hover:text-white border border-transparent"
                )}
              >
                {tab.label}
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  filterType === tab.key ? "bg-primary/20 text-primary" : "bg-white/10 text-white/40"
                )}>
                  {tab.count}
                </span>
                {(tab as any).badge > 0 && (
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {/* Preferenze notifiche */}
          <div className="mb-5">
            <button
              onClick={() => setPrefsOpen((v) => !v)}
              className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors group mb-2"
            >
              <Settings size={13} className="group-hover:rotate-45 transition-transform" />
              Preferenze notifiche
              {prefsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {Object.values(prefs).some((v) => !v) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-semibold">
                  {Object.values(prefs).filter((v) => !v).length} disabilitat{Object.values(prefs).filter((v) => !v).length === 1 ? "a" : "e"}
                </span>
              )}
            </button>
            {prefsOpen && (
              <div className="bg-card/40 border border-white/8 rounded-xl p-4 space-y-2.5">
                <p className="text-xs text-white/30 mb-3">Scegli quali categorie di notifiche ricevere. Le categorie disabilitate vengono nascoste ma non eliminate.</p>
                {PREF_CATEGORIES.map((cat) => {
                  const enabled = prefs[cat.key] !== false;
                  return (
                    <div key={cat.key} className="flex items-center justify-between gap-3">
                      <span className={cn("text-sm transition-colors", enabled ? "text-white" : "text-white/30 line-through")}>{cat.label}</span>
                      <button
                        onClick={() => togglePref(cat.key)}
                        className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors font-semibold", enabled ? "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20" : "bg-white/5 border-white/10 text-white/30 hover:text-white hover:border-white/20")}
                      >
                        {enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {enabled ? "Attiva" : "Disattiva"}
                      </button>
                    </div>
                  );
                })}
                {Object.values(prefs).some((v) => !v) && (
                  <button
                    onClick={() => { const all = Object.fromEntries(PREF_CATEGORIES.map((c) => [c.key, true])); setPrefs(all); savePrefs(all); }}
                    className="mt-2 w-full text-xs text-white/40 hover:text-white border border-white/10 hover:border-white/20 py-1.5 rounded-lg transition-colors"
                  >
                    Riabilita tutto
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-white/30" />
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-16">
              <Bell size={40} className="mx-auto mb-4 text-white/10" />
              <p className="text-white/30 font-medium">
                {filterType === "chat_message"    ? "Nessun messaggio ricevuto" :
                 filterType === "contact_request" ? "Nessuna richiesta di contatto" :
                 filterType === "other"           ? "Nessuna notifica di sistema" :
                 "Nessuna notifica ancora"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((n) => (
                <NotifCard
                  key={n.id}
                  n={n}
                  onMarkRead={(id) => markReadMutation.mutate(id)}
                  onOpenConv={openConversation}
                  onOpenContact={openContactRequest}
                  onReply={(notif, meta) => setReplyModal({ notif, meta })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {replyModal && (
        <QuickReplyModal
          notification={replyModal.notif}
          meta={replyModal.meta}
          onClose={() => setReplyModal(null)}
        />
      )}

      {confirmDeleteAll && (
        <ConfirmDeleteAllModal
          onConfirm={() => deleteAllMutation.mutate()}
          onCancel={() => setConfirmDeleteAll(false)}
          isPending={deleteAllMutation.isPending}
        />
      )}
    </div>
  );
}
