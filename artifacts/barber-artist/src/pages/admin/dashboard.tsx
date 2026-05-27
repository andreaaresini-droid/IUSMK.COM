import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useAdminStats } from "@/hooks/use-admin";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { Users, KeyRound, BookOpen, ImageIcon, Mail, ChevronRight, Brain, MessageSquareWarning } from "lucide-react";

export default function AdminDashboard() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: aiStats } = useQuery<{ newUnanswered: number; kbTotal: number }>({
    queryKey: ["admin", "ai-stats"],
    queryFn: () => fetchApi("/admin/ai/stats"),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/admin");
    }
  }, [user, authLoading, setLocation]);

  if (authLoading) return null;

  const statCards = [
    {
      title: "Account Registrati",
      value: stats?.totalStudents ?? 0,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
      href: "/admin/accounts",
    },
    {
      title: "Codici Attivi",
      value: stats?.activeCodes ?? 0,
      icon: KeyRound,
      color: "text-green-400",
      bg: "bg-green-500/10 border-green-500/20",
      href: "/admin/access-codes",
    },
    {
      title: "Corsi Pubblicati",
      value: stats?.totalCourses ?? 0,
      icon: BookOpen,
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
      href: "/admin/courses",
    },
    {
      title: "Elementi Galleria",
      value: stats?.totalGalleryItems ?? 0,
      icon: ImageIcon,
      color: "text-pink-400",
      bg: "bg-pink-500/10 border-pink-500/20",
      href: "/admin/gallery",
    },
    {
      title: "Richieste in Attesa",
      value: stats?.pendingContacts ?? 0,
      icon: Mail,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10 border-yellow-500/20",
      href: "/admin/contacts",
    },
    {
      title: "Domande AI Nuove",
      value: aiStats?.newUnanswered ?? 0,
      icon: MessageSquareWarning,
      color: "text-orange-400",
      bg: "bg-orange-500/10 border-orange-500/20",
      href: "/admin/ai",
    },
    {
      title: "KB Voci Attive",
      value: aiStats?.kbTotal ?? 0,
      icon: Brain,
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
      href: "/admin/ai",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />

      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wider">
            Panoramica del Sistema
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Benvenuto nel pannello IUSMK</p>
        </div>

        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-28 bg-card rounded-xl animate-pulse border border-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <button
                  key={stat.title}
                  onClick={() => setLocation(stat.href)}
                  className={`group relative bg-card/60 border ${stat.bg} rounded-xl p-4 text-left transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] hover:shadow-lg cursor-pointer min-h-[110px] flex flex-col justify-between`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white mb-0.5">{stat.value}</div>
                    <div className="text-xs text-muted-foreground leading-tight">{stat.title}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-8">
          <div className="bg-card/40 border border-white/5 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-3">Azioni Rapide</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: "Genera nuovo codice di accesso", href: "/admin/access-codes" },
                { label: "Aggiungi un corso", href: "/admin/courses" },
                { label: "Aggiungi foto alla galleria", href: "/admin/gallery" },
                { label: "Visualizza richieste di contatto", href: "/admin/contacts" },
              ].map((action) => (
                <button
                  key={action.href}
                  onClick={() => setLocation(action.href)}
                  className="w-full text-left flex items-center justify-between px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 transition-colors text-sm text-gray-300 hover:text-white"
                >
                  {action.label}
                  <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
