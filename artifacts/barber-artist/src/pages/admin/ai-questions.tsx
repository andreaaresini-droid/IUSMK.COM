import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquareWarning, CheckCircle, Eye, ChevronDown, ChevronUp, BookOpen, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Question = {
  id: number;
  question: string;
  normalizedQuestion: string;
  pageUrl: string;
  status: string;
  adminAnswer: string;
  aiFallbackMessage: string;
  occurrences: number;
  lastAskedAt: string;
  handledBy: string;
  createdAt: string;
  linkedKnowledgeItemId: number | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:      { label: "Nuova",        color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  reviewed: { label: "In revisione", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  answered: { label: "Risposta KB",  color: "bg-green-500/15 text-green-400 border-green-500/30" },
  ignored:  { label: "Ignorata",     color: "bg-white/5 text-white/30 border-white/10" },
};

export default function AdminAiQuestions() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter,     setFilter]     = useState("new");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [answers,    setAnswers]    = useState<Record<number, string>>({});
  const [kbTitles,   setKbTitles]  = useState<Record<number, string>>({});

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [user, authLoading, setLocation]);

  const { data: questions = [], isLoading, refetch } = useQuery<Question[]>({
    queryKey: ["admin", "ai-questions"],
    queryFn:  () => fetchApi("/admin/ai/unanswered-questions"),
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      fetchApi(`/admin/ai/unanswered-questions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "ai-questions"] }); },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, title, category }: { id: number; title?: string; category?: string }) =>
      fetchApi(`/admin/ai/unanswered-questions/${id}/publish`, {
        method: "POST",
        body: JSON.stringify({ title, category }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "ai-questions"] });
      qc.invalidateQueries({ queryKey: ["admin", "knowledge-base"] });
      qc.invalidateQueries({ queryKey: ["admin", "ai-stats"] });
      toast({ title: "Risposta pubblicata in Knowledge Base" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const filtered = filter === "all" ? questions : questions.filter((q) => q.status === filter);

  const counts = {
    all:      questions.length,
    new:      questions.filter((q) => q.status === "new").length,
    reviewed: questions.filter((q) => q.status === "reviewed").length,
    answered: questions.filter((q) => q.status === "answered").length,
    ignored:  questions.filter((q) => q.status === "ignored").length,
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-8">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wider flex items-center gap-3">
              <MessageSquareWarning className="w-7 h-7 text-yellow-400" />
              Domande AI
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Domande senza risposta salvate dall'assistente</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 rounded-xl text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Aggiorna
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-6">
          {(["all", "new", "reviewed", "answered", "ignored"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                filter === s
                  ? s === "new"
                    ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                    : "bg-primary/15 text-primary border-primary/30"
                  : "bg-white/5 text-white/50 border-white/10 hover:text-white"
              )}
            >
              {s === "all" ? "Tutte" : STATUS_LABELS[s]?.label ?? s}
              <span className="ml-1.5 text-white/30">({counts[s] ?? 0})</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-16 bg-card rounded-xl animate-pulse border border-white/5" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400/40" />
            <p className="text-sm">Nessuna domanda trovata.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => {
              const isExpanded  = expandedId === q.id;
              const statusInfo  = STATUS_LABELS[q.status] ?? STATUS_LABELS.new;
              const currentAnswer = answers[q.id] ?? q.adminAnswer ?? "";
              const kbTitle       = kbTitles[q.id] ?? `Domanda: ${q.question.slice(0, 100)}`;
              return (
                <div key={q.id} className="bg-card border border-white/8 rounded-xl overflow-hidden">
                  {/* Row */}
                  <button
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/3 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  >
                    <Eye className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium leading-snug">{q.question}</p>
                      <div className="flex items-center gap-3 flex-wrap mt-1">
                        <p className="text-xs text-muted-foreground">
                          {new Date(q.lastAskedAt || q.createdAt).toLocaleDateString("it-IT")}
                        </p>
                        {q.occurrences > 1 && (
                          <span className="text-[10px] bg-orange-500/15 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded-full">
                            ×{q.occurrences} volte
                          </span>
                        )}
                        {q.pageUrl && (
                          <span className="text-[10px] text-muted-foreground/60 truncate max-w-[120px]">{q.pageUrl}</span>
                        )}
                      </div>
                    </div>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border shrink-0", statusInfo.color)}>
                      {statusInfo.label}
                    </span>
                    {isExpanded
                      ? <ChevronUp   className="w-4 h-4 text-white/30 shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />}
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/6 pt-3">
                      {/* Original question detail */}
                      <div className="bg-white/3 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Domanda normalizzata</p>
                        <p className="text-xs text-white/50 font-mono">{q.normalizedQuestion}</p>
                      </div>

                      {/* AI fallback shown */}
                      {q.aiFallbackMessage && (
                        <div className="bg-white/4 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Risposta AI fornita al cliente</p>
                          <p className="text-xs text-white/60 italic">{q.aiFallbackMessage}</p>
                        </div>
                      )}

                      {/* Admin answer */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Risposta Admin</label>
                        <textarea
                          rows={4}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-primary/50 resize-none"
                          placeholder="Scrivi la risposta corretta per questa domanda…"
                          value={currentAnswer}
                          onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                        />
                      </div>

                      {/* KB title when publishing */}
                      {q.status !== "answered" && currentAnswer.trim() && (
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">Titolo voce KB (modificabile)</label>
                          <input
                            type="text"
                            value={kbTitle}
                            onChange={(e) => setKbTitles((t) => ({ ...t, [q.id]: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-primary/50"
                          />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={q.status}
                          onChange={(e) => updateMutation.mutate({ id: q.id, data: { status: e.target.value } })}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                        >
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k} className="bg-[#111]">{v.label}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => updateMutation.mutate({
                            id: q.id,
                            data: { adminAnswer: currentAnswer, status: q.status === "new" ? "reviewed" : q.status },
                          })}
                          disabled={updateMutation.isPending}
                          className="px-3 py-2 bg-white/8 hover:bg-white/15 text-white text-xs rounded-lg border border-white/10 transition-colors disabled:opacity-50"
                        >
                          Salva risposta
                        </button>

                        {q.status !== "answered" && (
                          <button
                            onClick={() => {
                              if (!currentAnswer.trim()) {
                                toast({ title: "Inserisci prima una risposta", variant: "destructive" }); return;
                              }
                              const doPublish = () => publishMutation.mutate({ id: q.id, title: kbTitle });
                              if (answers[q.id] && answers[q.id] !== q.adminAnswer) {
                                updateMutation.mutate(
                                  { id: q.id, data: { adminAnswer: answers[q.id] } },
                                  { onSuccess: doPublish }
                                );
                              } else {
                                doPublish();
                              }
                            }}
                            disabled={publishMutation.isPending || !currentAnswer.trim()}
                            className="px-3 py-2 bg-green-500/15 hover:bg-green-500/25 text-green-400 text-xs rounded-lg border border-green-500/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Pubblica in Knowledge Base
                          </button>
                        )}
                      </div>

                      {q.linkedKnowledgeItemId && (
                        <p className="text-xs text-green-400/70">
                          ✓ Pubblicata in KB — ID #{q.linkedKnowledgeItemId}
                          {q.handledBy && ` · gestita da ${q.handledBy}`}
                        </p>
                      )}
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
