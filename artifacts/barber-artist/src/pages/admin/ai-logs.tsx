import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { MessageSquare, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatLog = {
  id: number;
  sessionId: string;
  userMessage: string;
  aiReply: string;
  sourceKnowledgeIds: string;
  confidenceScore: number;
  usedFallback: boolean;
  escalatedToAdmin: boolean;
  pageUrl: string;
  ipAddress: string;
  createdAt: string;
};

export default function AdminAiLogs() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterFallback, setFilterFallback] = useState<"all" | "fallback" | "answered">("all");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [user, authLoading, setLocation]);

  const { data: logs = [], isLoading } = useQuery<ChatLog[]>({
    queryKey: ["admin", "ai-chat-logs"],
    queryFn:  () => fetchApi("/admin/ai/chat-logs?limit=200"),
    refetchInterval: 30_000,
  });

  const filtered = logs.filter((l) => {
    if (filterFallback === "fallback")  return l.usedFallback;
    if (filterFallback === "answered")  return !l.usedFallback;
    return true;
  });

  const confidenceLabel = (score: number) => {
    if (score >= 0.6) return { label: "Alta",  color: "text-green-400"  };
    if (score >= 0.35) return { label: "Media", color: "text-yellow-400" };
    return { label: "Bassa", color: "text-red-400" };
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-3 md:px-8 pb-8 min-w-0">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="mb-5">
          <h1 className="text-xl md:text-3xl font-display font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 md:w-7 md:h-7 text-blue-400 shrink-0" />
            Log Conversazioni AI
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-1">
            Storico completo di tutte le interazioni con l'assistente
          </p>
        </div>

        {/* ── Filtri tab — scroll orizzontale su mobile ─────────── */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {(["all", "answered", "fallback"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterFallback(f)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap",
                filterFallback === f
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-white/5 text-white/50 border-white/10 hover:text-white"
              )}
            >
              {f === "all"      && `Tutte (${logs.length})`}
              {f === "answered" && `Risposte AI (${logs.filter((l) => !l.usedFallback).length})`}
              {f === "fallback" && `Fallback (${logs.filter((l) => l.usedFallback).length})`}
            </button>
          ))}
        </div>

        {/* ── Lista log ─────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="h-14 bg-card rounded-xl animate-pulse border border-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nessun log trovato.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((log) => {
              const isExpanded = expandedId === log.id;
              const conf = confidenceLabel(log.confidenceScore);
              let kbIds: number[] = [];
              try { kbIds = JSON.parse(log.sourceKnowledgeIds || "[]"); } catch { kbIds = []; }

              return (
                <div
                  key={log.id}
                  className="bg-card border border-white/8 rounded-xl overflow-hidden"
                >
                  {/* ── Card header (sempre visibile) ─────────────── */}
                  <button
                    className="w-full flex items-start gap-2.5 p-3 text-left hover:bg-white/3 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    {log.usedFallback
                      ? <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                      : <CheckCircle2  className="w-4 h-4 text-green-400 shrink-0 mt-0.5"  />}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate leading-snug">{log.userMessage}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {new Date(log.createdAt).toLocaleString("it-IT")}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {/* Badge confidence — solo su sm+ */}
                      <span className={cn("text-[10px] font-medium hidden sm:inline", conf.color)}>
                        {log.usedFallback ? "Fallback" : conf.label}
                      </span>
                      {isExpanded
                        ? <ChevronUp   className="w-3.5 h-3.5 text-white/30" />
                        : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                    </div>
                  </button>

                  {/* ── Dettaglio espanso ─────────────────────────── */}
                  {isExpanded && (
                    <div className="border-t border-white/6 px-3 pb-3 pt-2.5 space-y-2.5">

                      {/* Messaggio utente */}
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">
                          Messaggio utente
                        </p>
                        <p className="text-xs md:text-sm text-white/90 bg-white/4 rounded-lg px-2.5 py-2 break-words leading-relaxed">
                          {log.userMessage}
                        </p>
                      </div>

                      {/* Risposta AI */}
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">
                          {log.usedFallback ? "Risposta fallback" : "Risposta AI"}
                        </p>
                        <p className="text-xs md:text-sm text-white/80 bg-white/4 rounded-lg px-2.5 py-2 whitespace-pre-wrap break-words leading-relaxed">
                          {log.aiReply || "—"}
                        </p>
                      </div>

                      {/* Metadata — un solo blocco compatto */}
                      <div className="bg-white/3 rounded-lg px-2.5 py-2 space-y-1.5 text-[10px] md:text-xs">

                        {/* Riga pills: confidence + KB + escalated */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("font-semibold", conf.color)}>
                            {(log.confidenceScore * 100).toFixed(0)}% — {conf.label}
                          </span>
                          {kbIds.length > 0 && (
                            <span className="bg-violet-500/15 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded-full text-[10px]">
                              KB ×{kbIds.length}
                            </span>
                          )}
                          {log.escalatedToAdmin && (
                            <span className="text-orange-400 font-medium">↑ Segnalato</span>
                          )}
                        </div>

                        {/* Session ID — font mono piccolo, break-all */}
                        {log.sessionId && (
                          <div className="flex gap-1.5 min-w-0">
                            <span className="shrink-0 text-muted-foreground/50">ID</span>
                            <span className="font-mono text-white/40 break-all text-[10px] leading-relaxed">
                              {log.sessionId}
                            </span>
                          </div>
                        )}

                        {/* KB IDs lista */}
                        {kbIds.length > 0 && (
                          <div className="flex gap-1.5 min-w-0">
                            <span className="shrink-0 text-muted-foreground/50">KB</span>
                            <span className="text-white/40 break-words">[{kbIds.join(", ")}]</span>
                          </div>
                        )}

                        {/* Page URL */}
                        {log.pageUrl && (
                          <div className="flex gap-1.5 min-w-0">
                            <span className="shrink-0 text-muted-foreground/50">URL</span>
                            <span className="text-white/40 break-all">{log.pageUrl}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
