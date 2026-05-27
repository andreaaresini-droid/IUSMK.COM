import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Send, Loader2, Lock, LockOpen, CheckCheck,
  ArrowLeft, Plus, Search, X, UserPlus, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Conversation {
  id:               number;
  userId:           number;
  userName:         string;
  userEmail:        string;
  status:           "open" | "closed";
  lastMessage:      string | null;
  lastMessageSenderType: "admin" | "user" | null;
  unreadAdminCount: number;
  unreadUserCount:  number;
  lastMessageAt:    string | null;
  createdAt:        string;
}

interface ChatMessage {
  id:             number;
  conversationId: number;
  senderType:     "admin" | "user";
  content:        string;
  readAt:         string | null;
  createdAt:      string;
}

interface ConversationDetail {
  conversation: Conversation;
  messages:     ChatMessage[];
}

interface UserAccount {
  id:    number;
  name:  string;
  email: string;
  role:  string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Oggi";
  if (date.toDateString() === yesterday.toDateString()) return "Ieri";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "long" });
}
function fmtRelative(d: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return "adesso";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min fa`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h fa`;
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}
function groupMsgsByDay(msgs: ChatMessage[]) {
  const groups: { date: string; msgs: ChatMessage[] }[] = [];
  let cur = "";
  for (const m of msgs) {
    const d = fmtDate(m.createdAt);
    if (d !== cur) { cur = d; groups.push({ date: d, msgs: [] }); }
    groups[groups.length - 1].msgs.push(m);
  }
  return groups;
}

// ─── CREATE CHAT MODAL ────────────────────────────────────────────────────────

function CreateChatModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (convId: number) => void;
}) {
  const [search, setSearch]         = useState("");
  const [selectedUser, setSelected] = useState<UserAccount | null>(null);
  const [firstMsg, setFirstMsg]     = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: searchResult, isLoading: searching } = useQuery<{ accounts: UserAccount[]; total: number }>({
    queryKey: ["admin", "accounts-search", search],
    queryFn:  () => fetchApi(`/admin/accounts?search=${encodeURIComponent(search)}&limit=20`),
    enabled:  true,
  });

  const users = searchResult?.accounts ?? [];

  const { mutate: startChat, isPending } = useMutation({
    mutationFn: () => fetchApi("/admin/chat/start", {
      method: "POST",
      body: JSON.stringify({ userId: selectedUser!.id, firstMessage: firstMsg.trim() || undefined }),
    }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin", "chat", "conversations"] });
      if (data.isExisting) {
        toast({ title: "Chat già esistente", description: `Apertura conversazione con ${selectedUser!.name}…` });
      } else {
        toast({ title: "Chat creata", description: `Nuova conversazione con ${selectedUser!.name} avviata.` });
      }
      onCreated(data.conversation.id);
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare la chat.", variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <UserPlus size={18} className="text-primary" />
            <h2 className="text-base font-bold text-white">Nuova conversazione</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Step 1: select user */}
          {!selectedUser ? (
            <>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Cerca utente</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nome, email…"
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-primary/40"
                  />
                </div>
              </div>

              {/* Results */}
              <div className="max-h-60 overflow-y-auto rounded-xl border border-white/8 divide-y divide-white/5">
                {searching && (
                  <div className="py-8 text-center">
                    <Loader2 size={20} className="animate-spin text-white/30 mx-auto" />
                  </div>
                )}
                {!searching && users.length === 0 && (
                  <div className="py-8 text-center text-white/30 text-sm">
                    {search ? "Nessun risultato" : "Scrivi per cercare un utente"}
                  </div>
                )}
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelected(u)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{u.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                      <p className="text-xs text-white/40 truncate">{u.email}</p>
                    </div>
                    <span className={cn(
                      "ml-auto shrink-0 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider",
                      u.role === "customer" ? "bg-blue-500/15 text-blue-400" : "bg-white/10 text-white/40"
                    )}>
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Step 2: confirm & optional message */
            <>
              {/* Selected user */}
              <div className="flex items-center gap-3 bg-primary/8 border border-primary/15 rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{selectedUser.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{selectedUser.name}</p>
                  <p className="text-xs text-white/40">{selectedUser.email}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white transition-colors p-1 shrink-0">
                  <X size={14} />
                </button>
              </div>

              {/* Optional first message */}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                  Primo messaggio (opzionale)
                </label>
                <textarea
                  value={firstMsg}
                  onChange={(e) => setFirstMsg(e.target.value)}
                  placeholder="Scrivi un messaggio iniziale…"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-primary/40 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={() => startChat()}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/80 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPending ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
                  Crea chat
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CONVERSATION LIST ────────────────────────────────────────────────────────

function ConvList({
  convs, selectedId, onSelect, onDeleteRequest,
}: {
  convs: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDeleteRequest: (id: number) => void;
}) {
  if (convs.length === 0) {
    return (
      <div className="py-16 px-6 text-center">
        <MessageSquare size={36} className="mx-auto mb-4 text-white/10" />
        <p className="text-white/30 text-sm font-medium">Nessuna conversazione</p>
        <p className="text-white/20 text-xs mt-1">Usa "Nuova chat" per iniziare</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">
      {convs.map((c) => (
        <div
          key={c.id}
          className={cn(
            "relative group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/5 cursor-pointer",
            selectedId === c.id && "bg-primary/5 border-l-2 border-primary"
          )}
          onClick={() => onSelect(c.id)}
        >
          <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-sm font-bold text-primary">{c.userName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white truncate">{c.userName}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                {c.unreadAdminCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                    {c.unreadAdminCount > 9 ? "9+" : c.unreadAdminCount}
                  </span>
                )}
                <span className="text-[10px] text-white/25">{fmtRelative(c.lastMessageAt)}</span>
              </div>
            </div>
            <p className="text-xs text-white/40 truncate mt-0.5">
              {c.lastMessage
                ? (c.lastMessageSenderType === "admin" ? "Tu: " : "") + c.lastMessage
                : c.userEmail}
            </p>
            {c.status === "closed" && (
              <span className="text-[10px] text-white/25 flex items-center gap-0.5 mt-0.5"><Lock size={9} /> Chiusa</span>
            )}
          </div>

          {/* Trash icon — visible on hover (desktop) or always visible (mobile) */}
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteRequest(c.id); }}
            className="shrink-0 mt-0.5 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 max-md:opacity-100"
            title="Elimina chat"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── CONVERSATION VIEW ────────────────────────────────────────────────────────

function ConvView({ convId, onBack, onDeleteRequest }: { convId: number; onBack: () => void; onDeleteRequest: () => void }) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<ConversationDetail>({
    queryKey: ["admin", "chat", convId],
    queryFn:  () => fetchApi(`/admin/chat/${convId}/messages`),
    refetchInterval: 6_000,
  });

  const { mutate: markRead } = useMutation({
    mutationFn: () => fetchApi(`/admin/chat/${convId}/read`, { method: "PUT" }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["admin", "chat", "conversations"] });
      qc.invalidateQueries({ queryKey: ["admin", "chat", "unread"] });
    },
  });

  useEffect(() => { markRead(); }, [convId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages?.length]);

  const { mutate: sendReply, isPending: sending } = useMutation({
    mutationFn: (content: string) => fetchApi(`/admin/chat/${convId}/reply`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
    onSuccess: () => {
      setInput("");
      qc.invalidateQueries({ queryKey: ["admin", "chat", convId] });
      qc.invalidateQueries({ queryKey: ["admin", "chat", "conversations"] });
    },
  });

  const { mutate: toggleStatus } = useMutation({
    mutationFn: (status: "open" | "closed") => fetchApi(`/admin/chat/${convId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "chat", convId] });
      qc.invalidateQueries({ queryKey: ["admin", "chat", "conversations"] });
    },
  });

  const handleSend = () => {
    const c = input.trim();
    if (!c || sending) return;
    sendReply(c);
  };

  const conv     = data?.conversation;
  const msgs     = data?.messages ?? [];
  const isClosed = conv?.status === "closed";
  const groups   = groupMsgsByDay(msgs);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/8 shrink-0 bg-card/50">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="md:hidden text-white/40 hover:text-white p-1 mr-1">
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{conv?.userName?.charAt(0).toUpperCase() ?? "?"}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-white">{conv?.userName ?? "…"}</p>
            <p className="text-xs text-white/40">{conv?.userEmail}</p>
          </div>
        </div>
        {conv && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleStatus(isClosed ? "open" : "closed")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
                isClosed
                  ? "border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "border-white/10 text-white/40 hover:text-white hover:border-white/20"
              )}
            >
              {isClosed ? <><LockOpen size={12} /> Riapri</> : <><Lock size={12} /> Chiudi</>}
            </button>
            <button
              onClick={onDeleteRequest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 text-xs font-semibold transition-colors"
              title="Elimina chat"
            >
              <Trash2 size={12} /> Elimina
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-white/30" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {msgs.length === 0 && (
            <p className="text-center text-white/25 text-sm py-8">Nessun messaggio ancora. Inizia la conversazione!</p>
          )}
          {groups.map(({ date, msgs: dayMsgs }) => (
            <div key={date}>
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-white/20 uppercase tracking-wider">{date}</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
              {dayMsgs.map((msg) => {
                const isAdmin = msg.senderType === "admin";
                return (
                  <div key={msg.id} className={cn("flex mb-1.5", isAdmin ? "justify-end" : "justify-start")}>
                    {!isAdmin && (
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 mr-2 mt-1 text-[10px] text-white/50 font-bold">
                        {conv?.userName?.charAt(0).toUpperCase() ?? "U"}
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2.5",
                      isAdmin
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-card border border-white/8 text-white/90 rounded-bl-sm"
                    )}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className={cn("flex items-center gap-1 mt-1", isAdmin ? "justify-end" : "justify-start")}>
                        <span className={cn("text-[10px]", isAdmin ? "text-white/50" : "text-white/25")}>
                          {fmtTime(msg.createdAt)}
                        </span>
                        {isAdmin && msg.readAt && <CheckCheck size={10} className="text-white/60" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-white/8 p-3">
        {isClosed ? (
          <p className="text-center text-xs text-white/30 py-2 flex items-center justify-center gap-1.5">
            <Lock size={11} /> Conversazione chiusa —{" "}
            <button
              onClick={() => toggleStatus("open")}
              className="text-primary hover:underline"
            >
              Riapri
            </button>
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Risposta admin… (Invio per inviare)"
              rows={1}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:border-primary/40 outline-none resize-none max-h-28 overflow-y-auto"
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 112) + "px";
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-xl bg-primary hover:bg-primary/80 text-white flex items-center justify-center shrink-0 transition-colors disabled:opacity-40"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AdminChat() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [location, setLocation] = useLocation();
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConvId, setDeleteConvId] = useState<number | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [chatFilter, setChatFilter] = useState("all");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { mutate: deleteConv, isPending: deleting } = useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/chat/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      // If deleted conv was open, reset the panel
      if (selectedConvId === deleteConvId) setSelectedConvId(null);
      setDeleteConvId(null);
      qc.invalidateQueries({ queryKey: ["admin", "chat", "conversations"] });
      qc.invalidateQueries({ queryKey: ["admin", "chat", "unread"] });
      toast({ title: "Chat eliminata", description: "La conversazione è stata eliminata." });
    },
    onError: () => {
      setDeleteConvId(null);
      toast({ title: "Errore", description: "Impossibile eliminare la chat.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/admin");
    }
  }, [user, authLoading, setLocation]);

  // Support ?conv=ID navigation from notifications
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("conv");
    if (convId) {
      setSelectedConvId(parseInt(convId));
      // Clean up URL without triggering navigation
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: convs = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["admin", "chat", "conversations"],
    queryFn:  () => fetchApi("/admin/chat/conversations"),
    refetchInterval: 15_000,
  });

  if (authLoading) return null;

  const totalUnread = convs.reduce((s, c) => s + c.unreadAdminCount, 0);

  const filteredConvs = convs.filter((c) => {
    const q = chatSearch.toLowerCase().trim();
    if (q && !c.userName?.toLowerCase().includes(q) && !c.userEmail?.toLowerCase().includes(q) && !(c.lastMessage || "").toLowerCase().includes(q)) return false;
    if (chatFilter === "unread" && c.unreadAdminCount === 0) return false;
    if (chatFilter === "open"   && c.status !== "open")   return false;
    if (chatFilter === "closed" && c.status !== "closed") return false;
    return true;
  });

  const unreadConvs  = convs.filter((c) => c.unreadAdminCount > 0).length;
  const openConvs    = convs.filter((c) => c.status === "open").length;
  const closedConvs  = convs.filter((c) => c.status === "closed").length;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />

      <main className="flex-1 md:ml-64 pt-14 md:pt-0 flex flex-col" style={{ height: "100dvh" }}>
        {/* Page header */}
        <div className="bg-card border-b border-white/5 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={20} className="text-primary" />
              <h1 className="text-xl font-display font-bold text-white uppercase tracking-wider">Chat Clienti</h1>
              {totalUnread > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-primary text-white text-xs font-bold">{totalUnread}</span>
              )}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/80 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              <Plus size={16} /> Nuova chat
            </button>
          </div>
        </div>

        {/* Split view */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar list */}
          <div className={cn(
            "bg-card border-r border-white/5 flex flex-col overflow-hidden",
            "w-full md:w-80 lg:w-96 shrink-0",
            selectedConvId !== null ? "hidden md:flex" : "flex"
          )}>
            {/* Search + filter */}
            <div className="px-3 pt-3 pb-2 border-b border-white/5 shrink-0 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                  type="text"
                  value={chatSearch}
                  onChange={e => setChatSearch(e.target.value)}
                  placeholder="Cerca cliente, email, messaggio..."
                  className="w-full bg-white/5 border border-white/8 text-white pl-9 pr-8 py-2 text-xs rounded-lg placeholder:text-white/25 focus:outline-none focus:border-primary/40 transition-colors"
                />
                {chatSearch && (
                  <button onClick={() => setChatSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="flex gap-1 flex-wrap">
                {[
                  { value: "all",    label: `Tutti (${convs.length})` },
                  { value: "unread", label: `Non lette${unreadConvs > 0 ? ` (${unreadConvs})` : ""}` },
                  { value: "open",   label: `Aperte (${openConvs})` },
                  { value: "closed", label: `Chiuse (${closedConvs})` },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setChatFilter(f.value)}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors",
                      chatFilter === f.value
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-white/5 text-white/40 hover:text-white border border-transparent"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
                {(chatSearch || chatFilter !== "all") && (
                  <button
                    onClick={() => { setChatSearch(""); setChatFilter("all"); }}
                    className="px-2 py-1 rounded-lg text-[10px] text-white/30 hover:text-white border border-white/10 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/25">
                {filteredConvs.length} di {convs.length} conversazion{convs.length !== 1 ? "i" : "e"}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading
                ? <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-white/30" /></div>
                : <ConvList convs={filteredConvs} selectedId={selectedConvId} onSelect={setSelectedConvId} onDeleteRequest={setDeleteConvId} />
              }
            </div>
          </div>

          {/* Conversation detail */}
          <div className={cn(
            "flex-1 flex flex-col overflow-hidden",
            selectedConvId === null ? "hidden md:flex" : "flex"
          )}>
            {selectedConvId === null ? (
              <div className="flex-1 flex items-center justify-center flex-col gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <MessageSquare size={28} className="text-primary/50" />
                </div>
                <div className="text-center">
                  <p className="text-white/30 text-sm font-medium">Seleziona una conversazione</p>
                  <p className="text-white/20 text-xs mt-1">oppure</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  <Plus size={16} /> Nuova chat
                </button>
              </div>
            ) : (
              <ConvView
                key={selectedConvId}
                convId={selectedConvId}
                onBack={() => setSelectedConvId(null)}
                onDeleteRequest={() => setDeleteConvId(selectedConvId)}
              />
            )}
          </div>
        </div>
      </main>

      {/* Create chat modal */}
      {showCreateModal && (
        <CreateChatModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(convId) => {
            setShowCreateModal(false);
            setSelectedConvId(convId);
            qc.invalidateQueries({ queryKey: ["admin", "chat", "conversations"] });
          }}
        />
      )}

      {/* Delete chat confirmation modal */}
      {deleteConvId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Elimina chat</h2>
                <p className="text-xs text-white/40 mt-0.5">Questa azione è irreversibile</p>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-6">
              Vuoi eliminare questa chat? Tutti i messaggi e le notifiche collegate verranno rimossi definitivamente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConvId(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors disabled:opacity-40"
              >
                Annulla
              </button>
              <button
                onClick={() => deleteConv(deleteConvId)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
