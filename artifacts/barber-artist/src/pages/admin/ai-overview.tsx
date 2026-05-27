import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, MessageSquareWarning, CheckCircle, MessageSquare,
  AlertTriangle, ChevronRight, Bot, Database, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AiStats = {
  newUnanswered:    number;
  kbPublished:      number;
  kbTotal:          number;
  chatsLast24h:     number;
  fallbacksLast24h: number;
  handledToday:     number;
};

export default function AdminAiOverview() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [user, authLoading, setLocation]);

  const { data: stats, isLoading } = useQuery<AiStats>({
    queryKey: ["admin", "ai-stats"],
    queryFn:  () => fetchApi("/admin/ai/stats"),
    refetchInterval: 30_000,
  });

  const seedMutation = useMutation({
    mutationFn: () =>
      fetchApi("/admin/ai/seed-kb", { method: "POST" }),
    onSuccess: (data: { created: number; skipped: number; total: number }) => {
      qc.invalidateQueries({ queryKey: ["admin", "ai-stats"] });
      qc.invalidateQueries({ queryKey: ["admin", "knowledge-base"] });
      toast({
        title: data.created > 0
          ? `Seed completato: ${data.created} voci aggiunte, ${data.skipped} già presenti`
          : `Nessuna voce nuova da aggiungere (${data.skipped} già presenti)`,
      });
    },
    onError: (e: Error) => toast({ title: "Errore seed KB", description: e.message, variant: "destructive" }),
  });

  if (authLoading) return null;

  const cards = [
    {
      label:  "Voci KB pubblicate",
      value:  stats?.kbPublished ?? 0,
      total:  stats?.kbTotal,
      icon:   Brain,
      color:  "text-violet-400",
      bg:     "bg-violet-500/10 border-violet-500/20",
      href:   "/admin/knowledge-base",
    },
    {
      label:  "Domande senza risposta",
      value:  stats?.newUnanswered ?? 0,
      icon:   MessageSquareWarning,
      color:  "text-yellow-400",
      bg:     "bg-yellow-500/10 border-yellow-500/20",
      href:   "/admin/ai-questions",
      alert:  (stats?.newUnanswered ?? 0) > 0,
    },
    {
      label:  "Gestite oggi",
      value:  stats?.handledToday ?? 0,
      icon:   CheckCircle,
      color:  "text-green-400",
      bg:     "bg-green-500/10 border-green-500/20",
      href:   "/admin/ai-questions",
    },
    {
      label:  "Chat ultime 24h",
      value:  stats?.chatsLast24h ?? 0,
      icon:   MessageSquare,
      color:  "text-blue-400",
      bg:     "bg-blue-500/10 border-blue-500/20",
      href:   "/admin/ai-logs",
    },
    {
      label:  "Fallback ultime 24h",
      value:  stats?.fallbacksLast24h ?? 0,
      icon:   AlertTriangle,
      color:  "text-orange-400",
      bg:     "bg-orange-500/10 border-orange-500/20",
      href:   "/admin/ai-logs",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wider">
                Assistente AI
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">Panoramica sistema knowledge base e conversazioni</p>
            </div>
          </div>

          {/* Seed KB button */}
          <button
            onClick={() => {
              if (confirm("Aggiungere le voci iniziali mancanti alla Knowledge Base? Le voci già presenti non verranno duplicate.")) {
                seedMutation.mutate();
              }
            }}
            disabled={seedMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {seedMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Database className="w-4 h-4" />}
            Seed Knowledge Base
          </button>
        </div>

        {/* Stats cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="h-28 bg-card rounded-xl animate-pulse border border-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.label}
                  onClick={() => setLocation(c.href)}
                  className={cn(
                    "group relative text-left rounded-xl p-4 border transition-all hover:scale-[1.03] active:scale-[0.98] flex flex-col justify-between min-h-[110px]",
                    "bg-card/60",
                    c.bg
                  )}
                >
                  {c.alert && (
                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-yellow-400 border-2 border-background" />
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", c.bg)}>
                      <Icon className={cn("w-5 h-5", c.color)} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white mb-0.5">
                      {c.value}
                      {c.total !== undefined && (
                        <span className="text-base text-muted-foreground font-normal ml-1">/ {c.total}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight">{c.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              title:       "Knowledge Base",
              description: "Gestisci le voci di conoscenza usate dall'assistente",
              href:        "/admin/knowledge-base",
              icon:        Brain,
              color:       "text-violet-400",
              bg:          "bg-violet-500/10 border-violet-500/20",
            },
            {
              title:       "Domande AI",
              description: "Rispondi alle domande non gestite e pubblicale in KB",
              href:        "/admin/ai-questions",
              icon:        MessageSquareWarning,
              color:       "text-yellow-400",
              bg:          "bg-yellow-500/10 border-yellow-500/20",
              badge:       stats?.newUnanswered,
            },
            {
              title:       "Log Conversazioni",
              description: "Storico completo delle conversazioni AI con i visitatori",
              href:        "/admin/ai-logs",
              icon:        MessageSquare,
              color:       "text-blue-400",
              bg:          "bg-blue-500/10 border-blue-500/20",
            },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.href}
                onClick={() => setLocation(link.href)}
                className="group text-left bg-card border border-white/8 hover:border-white/15 rounded-xl p-5 transition-all hover:bg-card/80"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 border", link.bg)}>
                  <Icon className={cn("w-5 h-5", link.color)} />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-white">{link.title}</p>
                  {link.badge ? (
                    <span className="text-[10px] bg-yellow-400 text-black font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {link.badge}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{link.description}</p>
                <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground group-hover:text-white transition-colors">
                  Apri <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Info box */}
        <div className="mt-6 bg-violet-500/5 border border-violet-500/15 rounded-xl p-4 space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-violet-300 font-semibold">Come funziona:</span> L'assistente risponde solo con le informazioni presenti nella Knowledge Base pubblicata e attiva. Se una domanda non trova risposta adeguata, viene salvata in "Domande AI" per revisione. Solo l'admin può pubblicare una risposta nella KB.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-violet-300 font-semibold">Seed KB:</span> Il bottone in alto aggiunge tutte le voci standard mancanti. Le voci già presenti non vengono mai duplicate — è sicuro eseguirlo più volte.
          </p>
        </div>
      </main>
    </div>
  );
}
