import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useCurrentUser } from "@/hooks/use-auth";
import { useOwnedCourseIds } from "@/hooks/use-courses";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import {
  Send, Loader2, MessageSquare, CheckCheck, Lock, LockOpen,
  ChevronRight, CornerDownLeft, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id:             number;
  conversationId: number;
  senderType:     "admin" | "user";
  senderId:       number;
  content:        string;
  readAt:         string | null;
  createdAt:      string;
}

const REOPEN_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 ore in ms

interface ChatConversation {
  id:                  number;
  userId:              number;
  status:              "open" | "closed";
  unreadUserCount:     number;
  unreadAdminCount:    number;
  lastMessageAt:       string | null;
  lastReopenRequestAt: string | null;
  createdAt:           string;
}

function formatCooldownLeft(lastReopenRequestAt: string | null): string | null {
  if (!lastReopenRequestAt) return null;
  const msLeft = REOPEN_COOLDOWN_MS - (Date.now() - new Date(lastReopenRequestAt).getTime());
  if (msLeft <= 0) return null;
  const totalMins = Math.ceil(msLeft / 60000);
  const hoursLeft = Math.floor(totalMins / 60);
  const minsLeft  = totalMins % 60;
  const parts: string[] = [];
  if (hoursLeft > 0) parts.push(`${hoursLeft} or${hoursLeft === 1 ? "a" : "e"}`);
  if (minsLeft  > 0) parts.push(`${minsLeft} minut${minsLeft === 1 ? "o" : "i"}`);
  return parts.join(" e ");
}

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

function groupMessagesByDay(messages: ChatMessage[]) {
  const groups: { date: string; msgs: ChatMessage[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const d = fmtDate(msg.createdAt);
    if (d !== currentDate) {
      currentDate = d;
      groups.push({ date: d, msgs: [] });
    }
    groups[groups.length - 1].msgs.push(msg);
  }
  return groups;
}

export default function CustomerChat() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const [input, setInput] = useState("");
  const [tick, setTick]   = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const qc             = useQueryClient();
  const { toast }      = useToast();

  const isLoggedIn = !!user && (user.role === "customer" || user.role === "student");
  const { data: ownedCourses, isLoading: coursesLoading } = useOwnedCourseIds(isLoggedIn);

  const isStudent =
    user?.role === "student" ||
    (user?.role === "customer" && (ownedCourses?.courseIds?.length ?? 0) > 0);

  const isAuthorized = isLoggedIn && isStudent;

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      setLocation("/login");
    }
  }, [isLoggedIn, authLoading, setLocation]);

  // Tick ogni minuto per aggiornare il countdown del cooldown reopen
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, refetch } = useQuery<{ conversation: ChatConversation; messages: ChatMessage[] }>({
    queryKey: ["customer", "chat"],
    queryFn:  () => fetchApi("/customer/chat"),
    enabled:  isAuthorized,
    refetchInterval: 8_000,
  });

  // Mark as read when entering the page
  const { mutate: markRead } = useMutation({
    mutationFn: () => fetchApi("/customer/chat/read", { method: "PUT" }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["customer", "chat", "unread"] }),
  });

  useEffect(() => {
    if (data?.conversation) {
      markRead();
    }
  }, [data?.conversation?.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages?.length]);

  const { mutate: sendMsg, isPending: sending } = useMutation({
    mutationFn: (content: string) => fetchApi("/customer/chat/messages", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
    onSuccess: () => {
      setInput("");
      qc.invalidateQueries({ queryKey: ["customer", "chat"] });
    },
  });

  const { mutate: closeChat, isPending: closing } = useMutation({
    mutationFn: () => fetchApi("/customer/chat/close", { method: "PUT" }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["customer", "chat"] }),
  });

  const { mutate: requestReopen, isPending: requestingReopen } = useMutation({
    mutationFn: () => fetchApi("/customer/chat/reopen-request", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", "chat"] });
      toast({ title: "Richiesta inviata", description: "Giuseppe riceverà la tua richiesta di apertura." });
    },
    onError: (err: any) => {
      qc.invalidateQueries({ queryKey: ["customer", "chat"] });
      const msg: string = err?.message ?? "";
      const isRateLimit = msg.toLowerCase().includes("puoi inviare") || msg.toLowerCase().includes("riprova");
      if (!isRateLimit) {
        toast({ title: "Errore", description: msg || "Impossibile inviare la richiesta.", variant: "destructive" });
      }
    },
  });

  const handleSend = () => {
    const content = input.trim();
    if (!content || sending) return;
    sendMsg(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (authLoading || (isLoggedIn && coursesLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (isLoggedIn && !isStudent) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 pt-20 md:pt-24 flex items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
              <Lock size={28} className="text-primary/60" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Sezione riservata agli studenti</h2>
            <p className="text-sm text-white/50 mb-6">
              La chat con Giuseppe è disponibile solo per chi ha acquistato o attivato almeno un corso.
            </p>
            <a
              href="/access"
              className="inline-block bg-primary text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
            >
              Attiva un codice corso
            </a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAuthorized || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const conv = data?.conversation;
  const msgs = data?.messages ?? [];
  const isClosed = conv?.status === "closed";
  const groups = groupMessagesByDay(msgs);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-20 md:pt-24 flex flex-col">
        {/* Chat header */}
        <div className="bg-card border-b border-white/8 px-4 py-4 shrink-0">
          <div className="container mx-auto max-w-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">G</span>
              </div>
              <div>
                <p className="font-bold text-white text-sm">Giuseppe — IUSMK</p>
                <div className="flex items-center gap-1.5">
                  {isClosed ? (
                    <span className="text-xs text-white/30 flex items-center gap-1"><Lock size={10} /> Conversazione chiusa</span>
                  ) : (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Online
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!isClosed && (
              <button
                onClick={() => closeChat()}
                disabled={closing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/40 hover:text-white hover:border-white/20 transition-colors"
              >
                <Lock size={12} /> Chiudi chat
              </button>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="container mx-auto max-w-2xl px-4 space-y-1">
            {msgs.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare size={40} className="mx-auto text-white/10 mb-3" />
                <p className="text-white/30 text-sm">Scrivi il tuo primo messaggio a Giuseppe</p>
                <p className="text-white/20 text-xs mt-1">Risponde solitamente entro qualche ora</p>
              </div>
            ) : (
              groups.map(({ date, msgs: dayMsgs }) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] text-white/25 uppercase tracking-wider">{date}</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  {dayMsgs.map((msg) => {
                    const isUser = msg.senderType === "user";
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex mb-1.5", isUser ? "justify-end" : "justify-start")}
                      >
                        {/* Admin avatar */}
                        {!isUser && (
                          <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 mr-2 mt-1">
                            <span className="text-[10px] font-bold text-primary">G</span>
                          </div>
                        )}

                        <div className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2.5",
                          isUser
                            ? "bg-primary text-white rounded-br-sm"
                            : "bg-card border border-white/8 text-white/90 rounded-bl-sm"
                        )}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                          <div className={cn("flex items-center gap-1 mt-1", isUser ? "justify-end" : "justify-start")}>
                            <span className={cn("text-[10px]", isUser ? "text-white/50" : "text-white/25")}>
                              {fmtTime(msg.createdAt)}
                            </span>
                            {isUser && msg.readAt && (
                              <CheckCheck size={10} className="text-white/60" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-white/8 bg-card/80 backdrop-blur-sm px-4 py-3">
          <div className="container mx-auto max-w-2xl">
            {isClosed ? (
              <div className="py-3 space-y-3">
                <div className="flex items-center justify-center gap-2 text-sm text-white/30">
                  <Lock size={14} />
                  <span>La chat è chiusa. Puoi inviare una richiesta a Giuseppe per riaprirla.</span>
                </div>

                {/* Countdown / bottone reopen — ricalcolato ogni minuto tramite tick */}
                {(() => {
                  void tick; // dipendenza per ricalcolo ogni minuto
                  const cooldownLabel = formatCooldownLeft(conv?.lastReopenRequestAt ?? null);
                  if (cooldownLabel) {
                    return (
                      <p className="text-center text-xs text-amber-400/80 bg-amber-500/8 border border-amber-500/15 rounded-lg px-3 py-2">
                        Puoi inviare una nuova richiesta di riapertura tra {cooldownLabel}.
                      </p>
                    );
                  }
                  return (
                    <div className="flex justify-center">
                      <button
                        onClick={() => requestReopen()}
                        disabled={requestingReopen}
                        className="flex items-center gap-2 px-5 py-2 bg-white/8 hover:bg-white/12 border border-white/15 hover:border-white/25 text-white/70 hover:text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
                      >
                        {requestingReopen
                          ? <Loader2 size={14} className="animate-spin" />
                          : <RefreshCw size={14} />
                        }
                        Richiedi apertura chat
                      </button>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Scrivi un messaggio… (Invio per inviare)"
                  rows={1}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:border-primary/40 outline-none resize-none max-h-32 overflow-y-auto leading-relaxed"
                  style={{ minHeight: "46px" }}
                  onInput={(e) => {
                    const t = e.target as HTMLTextAreaElement;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 128) + "px";
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="w-11 h-11 rounded-xl bg-primary hover:bg-primary/80 text-white flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            )}
            <p className="text-[10px] text-white/20 text-center mt-2">
              Premi Invio per inviare · Shift+Invio per andare a capo
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
