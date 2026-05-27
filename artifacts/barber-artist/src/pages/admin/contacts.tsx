import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAdminContacts, useDeleteContact } from "@/hooks/use-admin";
import { Mail, Phone, AlertCircle, RefreshCw, Trash2, Bell, BellOff, Search, X, MessageSquare, Loader2, ArrowUpDown } from "lucide-react";
import { fetchApi } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useToast } from "@/hooks/use-toast";

const SUBJECT_LABELS: Record<string, string> = {
  booking: "Prenotazione",
  course_info: "Info Corso",
  collaboration: "Collaborazione",
  other: "Altro",
};

function showBrowserNotification(name: string, subject: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    const label = SUBJECT_LABELS[subject] || subject;
    new Notification("Nuovo messaggio — IUSMK", {
      body: `${name} ha inviato una richiesta: ${label}`,
      icon: "/images/logo-iusmk-2025.png",
    });
  }
}

const READ_FILTERS = [
  { value: "all",    label: "Tutti" },
  { value: "unread", label: "Non letti" },
  { value: "read",   label: "Letti" },
];

const SORT_OPTIONS = [
  { value: "date_desc", label: "Più recenti" },
  { value: "date_asc",  label: "Più vecchi" },
  { value: "name_az",   label: "Nome A→Z" },
];

export default function AdminContacts() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { data: contacts, isLoading, isError, refetch } = useAdminContacts();
  const [selected, setSelected] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [newNotification, setNewNotification] = useState<{ name: string; subject: string } | null>(null);
  const queryClient = useQueryClient();
  const deleteContact = useDeleteContact();
  const prevContactCount = useRef<number | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [search, setSearch]       = useState("");
  const [readFilter, setReadFilter] = useState("all");
  const [sort, setSort]           = useState("date_desc");
  const [openingChat, setOpeningChat] = useState(false);
  const { toast } = useToast();
  const { status: pushStatus, error: pushError, subscribe, unsubscribe } = usePushNotifications();

  const handleOpenChat = useCallback(async () => {
    if (!selected || openingChat) return;
    setOpeningChat(true);
    try {
      const result = await fetchApi<{ accounts: any[]; total: number }>(
        `/admin/accounts?search=${encodeURIComponent(selected.email)}&limit=5`
      );
      const match = result.accounts.find(
        (a: any) => a.email.toLowerCase() === selected.email.toLowerCase()
      );
      if (!match) {
        toast({
          title:       "Utente non registrato",
          description: `${selected.email} non ha un account sul sito. Non è possibile aprire una chat interna.`,
          variant:     "destructive",
        });
        return;
      }
      const data = await fetchApi<any>("/admin/chat/start", {
        method: "POST",
        body:   JSON.stringify({ userId: match.id }),
      });
      toast({
        title:       data.isExisting ? "Chat esistente aperta" : "Nuova chat creata",
        description: `Conversazione con ${match.name} pronta.`,
      });
      setLocation(`/admin/chat?conv=${data.conversation.id}`);
    } catch (err) {
      toast({ title: "Errore", description: "Impossibile aprire la chat.", variant: "destructive" });
    } finally {
      setOpeningChat(false);
    }
  }, [selected, openingChat, toast, setLocation]);

  const filteredContacts = useMemo(() => {
    if (!Array.isArray(contacts)) return [];
    const q = search.toLowerCase().trim();
    let list = contacts.filter((c: any) => {
      const subjectLabel = (SUBJECT_LABELS[c.subject] || c.subject || "").toLowerCase();
      if (q && !c.name?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q) && !c.phone?.toLowerCase().includes(q) && !c.message?.toLowerCase().includes(q) && !subjectLabel.includes(q)) return false;
      if (readFilter === "unread" && c.isRead) return false;
      if (readFilter === "read" && !c.isRead) return false;
      return true;
    });
    list = [...list].sort((a: any, b: any) => {
      if (sort === "date_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "date_asc")  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "name_az")   return (a.name || "").localeCompare(b.name || "", "it");
      return 0;
    });
    return list;
  }, [contacts, search, readFilter, sort]);

  const hasActiveFilters = search || readFilter !== "all" || sort !== "date_desc";

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (!contacts) return;
    const currentCount = contacts.length;
    if (prevContactCount.current !== null && currentCount > prevContactCount.current) {
      const newest = contacts[0];
      if (newest && !newest.isRead) {
        showBrowserNotification(newest.name, newest.subject);
        setNewNotification({ name: newest.name, subject: newest.subject });
        if (notifTimer.current) clearTimeout(notifTimer.current);
        notifTimer.current = setTimeout(() => setNewNotification(null), 6000);
      }
    }
    prevContactCount.current = currentCount;
  }, [contacts]);

  const handleSelect = async (c: any) => {
    setSelected(c);
    setDeleteConfirm(false);
    setDeleteError(null);
    if (!c.isRead) {
      try {
        await fetchApi(`/admin/contact-requests/${c.id}/read`, { method: "POST" });
        queryClient.setQueryData(["admin", "contacts"], (old: any[]) =>
          old?.map(item => item.id === c.id ? { ...item, isRead: true } : item)
        );
        queryClient.invalidateQueries({ queryKey: ["admin", "contacts", "unread"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "notifications", "unread"] });
      } catch {}
    }
  };

  useEffect(() => {
    if (!contacts || contacts.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) return;
    const found = (contacts as any[]).find((c) => String(c.id) === id);
    if (found) {
      handleSelect(found);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [contacts]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!selected) return;
    setDeleteError(null);
    try {
      await deleteContact.mutateAsync(selected.id);
      setSelected(null);
      setDeleteConfirm(false);
    } catch {
      setDeleteError("Eliminazione fallita. Riprova.");
    }
  };

  if (authLoading) return null;

  const unreadCount  = contacts?.filter((c: any) => !c.isRead).length ?? 0;
  const totalCount   = contacts?.length ?? 0;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wider">
              Richieste di Contatto
            </h1>
            {unreadCount > 0 && (
              <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount} NUOVI
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {pushStatus === "unsubscribed" && (
              <button onClick={subscribe} className="flex items-center gap-2 text-primary hover:text-primary/80 text-xs border border-primary/30 px-3 py-1.5 transition-colors">
                <Bell className="w-3.5 h-3.5" /> Attiva notifiche push
              </button>
            )}
            {pushStatus === "denied" && (
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <BellOff className="w-3.5 h-3.5" /> Push bloccate (sblocca nel browser)
              </span>
            )}
            {pushStatus === "subscribed" && (
              <button onClick={unsubscribe} className="flex items-center gap-2 text-green-500/80 hover:text-red-400 text-xs transition-colors">
                <Bell className="w-3.5 h-3.5" /> Push attive
              </button>
            )}
            {pushStatus === "unsupported" && (
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <BellOff className="w-3.5 h-3.5" /> Push non supportate
              </span>
            )}
            {pushError && <span className="text-xs text-red-400">{pushError}</span>}
            <button onClick={() => refetch()} className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors text-sm">
              <RefreshCw className="w-4 h-4" /> Aggiorna
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Totale",    value: totalCount,  color: "text-white" },
            { label: "Non letti", value: unreadCount, color: "text-yellow-400" },
            { label: "Filtrati",  value: filteredContacts.length, color: "text-primary" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card/50 border border-white/5 rounded-xl p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-white/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* In-app notification banner */}
        {newNotification && (
          <div className="mb-4 flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-4 py-3 text-sm animate-in slide-in-from-top-2">
            <Bell className="w-4 h-4 shrink-0" />
            <span>
              <strong>Nuovo messaggio da {newNotification.name}</strong> —{" "}
              {SUBJECT_LABELS[newNotification.subject] || newNotification.subject}
            </span>
            <button onClick={() => setNewNotification(null)} className="ml-auto text-yellow-500/60 hover:text-yellow-400 text-xs">✕</button>
          </div>
        )}

        {isLoading ? (
          <div className="text-muted-foreground">Caricamento...</div>
        ) : isError ? (
          <div className="flex items-center gap-3 text-red-400 bg-red-500/10 border border-red-500/20 p-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Errore nel caricamento delle richieste</p>
              <p className="text-xs text-red-400/70 mt-0.5">Controlla la connessione o riprova.</p>
            </div>
            <button onClick={() => refetch()} className="ml-auto text-xs underline hover:no-underline">Riprova</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List column */}
            <div className="lg:col-span-1 space-y-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca per nome, email, messaggio..."
                  className="w-full bg-card border border-white/10 text-white pl-9 pr-9 py-2.5 text-sm rounded-lg placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter chips + sort */}
              <div className="flex items-center gap-1 flex-wrap">
                {READ_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setReadFilter(f.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${readFilter === f.value ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-white/50 hover:text-white border border-transparent"}`}
                  >
                    {f.label}
                    {f.value === "unread" && unreadCount > 0 && (
                      <span className="ml-1 bg-yellow-500 text-black rounded-full text-[9px] px-1 font-bold">{unreadCount}</span>
                    )}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1">
                  <ArrowUpDown size={11} className="text-white/30" />
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                    className="bg-card border border-white/10 text-white text-xs px-2 py-1 rounded-lg focus:outline-none"
                  >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Reset */}
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearch(""); setReadFilter("all"); setSort("date_desc"); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white border border-white/10 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <X size={11} /> Reset filtri
                </button>
              )}

              {/* Empty states */}
              {filteredContacts.length === 0 && contacts && contacts.length > 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {search || readFilter !== "all"
                    ? <>Nessuna richiesta trovata. <button onClick={() => { setSearch(""); setReadFilter("all"); }} className="text-primary hover:underline">Azzera</button></>
                    : "Nessuna richiesta."
                  }
                </div>
              )}

              {filteredContacts.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className={`w-full text-left p-4 border transition-colors rounded-lg ${
                    selected?.id === c.id
                      ? "border-primary bg-primary/10"
                      : "border-white/5 bg-card/30 hover:bg-card/50"
                  } ${!c.isRead ? "border-l-2 border-l-yellow-500" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${!c.isRead ? "text-white" : "text-white/70"}`}>{c.name}</p>
                      <p className="text-muted-foreground text-xs truncate">{c.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground/60">{SUBJECT_LABELS[c.subject] || c.subject}</span>
                      {!c.isRead && <span className="text-xs text-yellow-500 font-semibold">NUOVO</span>}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{c.message}</p>
                  <p className="text-white/20 text-[10px] mt-1">{new Date(c.createdAt).toLocaleDateString("it-IT")}</p>
                </button>
              ))}

              {contacts && contacts.length === 0 && (
                <div className="text-center text-muted-foreground py-12 text-sm">
                  Nessuna richiesta di contatto ancora.
                </div>
              )}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-2">
              {selected ? (
                <div className="bg-card/30 border border-white/5 p-6 md:p-8 rounded-xl">
                  <div className="flex items-start justify-between mb-6 gap-4">
                    <div>
                      <h2 className="text-xl font-display font-bold text-white">{selected.name}</h2>
                      <p className="text-muted-foreground text-sm">{SUBJECT_LABELS[selected.subject] || selected.subject}</p>
                    </div>
                    <span className="text-xs text-muted-foreground/60 shrink-0">
                      {new Date(selected.createdAt).toLocaleString("it-IT")}
                    </span>
                  </div>

                  <div className="space-y-3 mb-6 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4 shrink-0" />
                      <a href={`mailto:${selected.email}`} className="hover:text-white break-all">{selected.email}</a>
                    </div>
                    {selected.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4 shrink-0" />
                        <span>{selected.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="border border-white/10 p-4 mb-6 rounded-lg">
                    <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleOpenChat}
                      disabled={openingChat}
                      className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-colors disabled:opacity-50 rounded-lg"
                    >
                      {openingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                      Apri chat
                    </button>

                    {!deleteConfirm ? (
                      <button
                        onClick={() => setDeleteConfirm(true)}
                        className="flex items-center gap-2 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-colors rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" /> Elimina
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-white/70">Sei sicuro?</span>
                        <button
                          onClick={handleDelete}
                          disabled={deleteContact.isPending}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-colors disabled:opacity-50 rounded-lg"
                        >
                          {deleteContact.isPending ? "Eliminazione..." : "Sì, elimina"}
                        </button>
                        <button
                          onClick={() => { setDeleteConfirm(false); setDeleteError(null); }}
                          className="text-muted-foreground hover:text-white text-sm px-3 py-2 border border-white/10 transition-colors rounded-lg"
                        >
                          Annulla
                        </button>
                      </div>
                    )}
                  </div>

                  {deleteError && (
                    <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" /> {deleteError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-card/30 border border-white/5 p-8 flex flex-col items-center justify-center h-64 text-muted-foreground rounded-xl">
                  <Mail className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">Seleziona un messaggio per leggerlo</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
