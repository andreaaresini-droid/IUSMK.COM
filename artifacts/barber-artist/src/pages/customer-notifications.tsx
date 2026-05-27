import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useCurrentUser } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import {
  Bell, CheckCheck, KeyRound, Loader2, BellOff,
  MessageSquare, BellRing, Trash2, Megaphone, ShoppingCart,
  BookOpen, User, Zap, Video, Play, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/use-push-notifications";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Adesso";
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ore fa`;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

type NotifType = string;

function notifIcon(type: NotifType, size = 18) {
  switch (type) {
    case "chat_message":        return <MessageSquare size={size} />;
    case "course_code_assigned":
    case "code_resent":         return <KeyRound size={size} />;
    case "course_update":       return <BookOpen size={size} />;
    case "order_update":
    case "purchase":            return <ShoppingCart size={size} />;
    case "account_update":      return <User size={size} />;
    case "promo_notification":  return <Zap size={size} />;
    case "broadcast":
    case "admin_notification":
    case "private_message":     return <Megaphone size={size} />;
    default:                    return <Bell size={size} />;
  }
}

function notifIconColor(type: NotifType, isRead: boolean) {
  if (isRead) return "text-white/30 bg-white/5";
  switch (type) {
    case "chat_message":        return "text-primary bg-primary/15";
    case "course_code_assigned":
    case "code_resent":
    case "course_update":       return "text-blue-400 bg-blue-500/15";
    case "order_update":
    case "purchase":            return "text-green-400 bg-green-500/15";
    case "promo_notification":  return "text-amber-400 bg-amber-500/15";
    default:                    return "text-primary bg-primary/10";
  }
}

function notifTypeLabel(type: NotifType): string {
  switch (type) {
    case "chat_message":        return "Messaggio";
    case "course_code_assigned":return "Codice corso";
    case "code_resent":         return "Codice reinviato";
    case "course_update":       return "Aggiornamento corso";
    case "order_update":
    case "purchase":            return "Ordine";
    case "account_update":      return "Account";
    case "promo_notification":  return "Promozione";
    case "admin_notification":
    case "private_message":     return "Comunicazione admin";
    case "broadcast":           return "Comunicazione";
    case "reminder":            return "Promemoria";
    case "system_notification": return "Sistema";
    default:                    return "Notifica";
  }
}

// ─── Confirm delete all ────────────────────────────────────────────────────────

function ConfirmDeleteAllModal({ onConfirm, onCancel, isPending }: {
  onConfirm: () => void; onCancel: () => void; isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-white font-semibold text-sm mb-1">Vuoi eliminare tutte le notifiche?</p>
        <p className="text-white/40 text-xs mb-5">Questa azione non può essere annullata.</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white transition-colors">Annulla</button>
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

// ─── Notification list card ────────────────────────────────────────────────────

function NotifListCard({
  notif,
  onClick,
  onDelete,
}: {
  notif: any;
  onClick: (id: number, type: string) => void;
  onDelete: (e: React.MouseEvent, id: number) => void;
}) {
  const hasImage = !!notif.imageUrl;
  const hasVideo = !!notif.videoUrl;
  const isChat   = notif.type === "chat_message";

  return (
    <div
      onClick={() => onClick(notif.id, notif.type)}
      className={cn(
        "relative flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all group",
        notif.isRead
          ? "bg-white/3 border-white/8 hover:bg-white/5 hover:border-white/15"
          : "bg-primary/8 border-primary/25 hover:bg-primary/12 hover:border-primary/35 shadow-[0_0_20px_rgba(212,20,20,0.06)]"
      )}
    >
      {/* Unread dot */}
      {!notif.isRead && (
        <span className="absolute top-4 right-10 w-2 h-2 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <div className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", notifIconColor(notif.type, notif.isRead))}>
        {notifIcon(notif.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className={cn("text-xs font-semibold", notif.isRead ? "text-white/30" : "text-white/50")}>
            {notifTypeLabel(notif.type)}
          </span>
          {hasImage && <span className="text-[10px] text-white/25">· 📷</span>}
          {hasVideo && <span className="text-[10px] text-white/25 flex items-center gap-0.5"><Video size={9} /> video</span>}
          <span className="text-[10px] text-white/25 ml-auto">{formatDate(notif.createdAt)}</span>
        </div>

        <p className={cn("font-semibold text-sm leading-snug", notif.isRead ? "text-white/60" : "text-white")}>
          {notif.title}
        </p>
        <p className="text-white/40 text-xs mt-0.5 line-clamp-2 leading-relaxed">
          {notif.message}
        </p>

        {/* Thumbnail */}
        {hasImage && (
          <div className="mt-2 flex items-center gap-2">
            <img
              src={notif.imageUrl}
              alt=""
              className="w-16 h-10 object-cover rounded-lg opacity-70 group-hover:opacity-90 transition-opacity"
            />
            <span className="text-xs text-white/30">Tocca per visualizzare l'immagine</span>
          </div>
        )}
        {hasVideo && !hasImage && (
          <div className="mt-2 flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Play size={14} className="text-white/40" />
            </div>
            <span className="text-xs text-white/30">Video allegato</span>
          </div>
        )}

        {/* Access code preview */}
        {notif.accessCode && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-lg px-2 py-1">
            <KeyRound size={11} className="text-primary" />
            <span className="font-mono text-xs text-primary font-bold tracking-wider">{notif.accessCode}</span>
          </div>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight size={16} className="text-white/20 group-hover:text-white/40 shrink-0 mt-1 transition-colors" />

      {/* Delete button — sempre visibile su mobile, hover su desktop */}
      <button
        onClick={(e) => onDelete(e, notif.id)}
        className="absolute bottom-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors md:opacity-0 md:group-hover:opacity-100"
        title="Elimina notifica"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Filter tabs ───────────────────────────────────────────────────────────────

type FilterKey = "all" | "messages" | "courses" | "promos" | "other";

const FILTER_DEFS: { key: FilterKey; label: string; match: (n: any) => boolean }[] = [
  { key: "all",      label: "Tutte",    match: () => true },
  { key: "messages", label: "Messaggi", match: (n) => n.type === "chat_message" },
  { key: "courses",  label: "Corsi",    match: (n) => ["course_code_assigned","code_resent","course_update","purchase","order_update"].includes(n.type) },
  { key: "promos",   label: "Promo",    match: (n) => ["promo_notification","broadcast"].includes(n.type) },
  { key: "other",    label: "Altro",    match: (n) => !["chat_message","course_code_assigned","code_resent","course_update","purchase","order_update","promo_notification","broadcast"].includes(n.type) },
];

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CustomerNotifications() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const { status: pushStatus, error: pushError, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications("customer");

  // Students (who activated a code) can also view their notifications
  const isAuthorized = !!user && (user.role === "customer" || user.role === "student");

  useEffect(() => {
    if (!userLoading && !isAuthorized) setLocation("/login");
  }, [isAuthorized, userLoading, setLocation]);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey:  ["customer-notifications"],
    queryFn:   () => fetchApi<any[]>("/customer/notifications"),
    enabled:   isAuthorized,
    refetchInterval: 30_000,
  });

  const markAllRead = useMutation({
    mutationFn: () => fetchApi("/customer/notifications/read-all", { method: "PUT" }),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["customer-notifications"] }),
  });
  const deleteOne = useMutation({
    mutationFn: (id: number) => fetchApi(`/customer/notifications/${id}`, { method: "DELETE" }),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["customer-notifications"] }),
  });
  const deleteAll = useMutation({
    mutationFn: () => fetchApi("/customer/notifications", { method: "DELETE" }),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ["customer-notifications"] }); setConfirmDeleteAll(false); },
  });

  function handleCardClick(id: number, type: string) {
    // Chat messages → go to chat
    if (type === "chat_message") {
      setLocation("/chat");
      return;
    }
    // All others → notification detail page (server auto-marks as read)
    setLocation(`/notifications/${id}`);
  }

  function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    deleteOne.mutate(id);
  }

  const allNotifs   = notifications as any[];
  const unreadCount = allNotifs.filter((n) => !n.isRead).length;

  const filterCounts = FILTER_DEFS.map((f) => ({
    ...f,
    count: allNotifs.filter(f.match).length,
  }));
  const visible = allNotifs.filter(FILTER_DEFS.find((f) => f.key === filter)!.match);

  if (userLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
            <div>
              <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-primary">Notifiche</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {unreadCount > 0 ? `${unreadCount} non lette` : "Tutte le notifiche lette"}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Push toggle */}
              {pushStatus === "subscribed" ? (
                <button onClick={pushUnsubscribe} className="flex items-center gap-1.5 text-xs text-green-400 border border-green-500/20 bg-green-500/8 hover:bg-green-500/15 px-3 py-1.5 rounded-lg transition-colors">
                  <BellRing size={12} /> Push attive
                </button>
              ) : pushStatus === "unsubscribed" ? (
                <button onClick={pushSubscribe} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors">
                  <Bell size={12} /> Attiva push
                </button>
              ) : pushStatus === "denied" ? (
                <span className="text-xs text-red-400/70 border border-red-500/15 px-3 py-1.5 rounded-lg">Push bloccate</span>
              ) : null}

              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5"
                >
                  <CheckCheck size={15} /> Segna tutte lette
                </button>
              )}

              {allNotifs.length > 0 && (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 border border-transparent hover:border-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Trash2 size={12} /> Elimina tutte
                </button>
              )}
            </div>
          </div>

          {/* Push denied */}
          {pushStatus === "denied" && (
            <div className="mb-5 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-xs leading-relaxed">
              Le notifiche push sono bloccate dal browser. Vai nelle impostazioni e consenti le notifiche per questo sito.
            </div>
          )}
          {pushError && <p className="mb-4 text-red-400 text-xs">{pushError}</p>}

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {filterCounts.filter((f) => f.key === "all" || f.count > 0).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  filter === f.key
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-white/5 text-white/50 hover:text-white border border-transparent"
                )}
              >
                {f.label}
                <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold", filter === f.key ? "bg-primary/20 text-primary" : "bg-white/10 text-white/40")}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-20">
              <BellOff size={40} className="text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-semibold">
                {filter === "all" ? "Nessuna notifica ancora" : "Nessuna notifica in questa categoria"}
              </p>
              {filter === "all" && (
                <p className="text-sm text-muted-foreground/60 mt-1">
                  Dopo un acquisto o un messaggio ricevuto, le notifiche appariranno qui.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((notif) => (
                <NotifListCard
                  key={notif.id}
                  notif={notif}
                  onClick={handleCardClick}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {allNotifs.length > 0 && (
            <p className="text-center text-xs text-muted-foreground mt-8">
              Usa il codice per accedere al corso dalla pagina{" "}
              <button onClick={() => setLocation("/access")} className="text-primary hover:underline">
                Accedi ai Corsi
              </button>
            </p>
          )}
        </div>
      </main>
      <Footer />

      {confirmDeleteAll && (
        <ConfirmDeleteAllModal
          onConfirm={() => deleteAll.mutate()}
          onCancel={() => setConfirmDeleteAll(false)}
          isPending={deleteAll.isPending}
        />
      )}
    </div>
  );
}
