import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { ShoppingCart, CheckCircle, Copy, Search, X, ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Purchase {
  id: number;
  courseId: number;
  courseTitle: string;
  customerName: string;
  customerEmail: string;
  amountPaid: number;
  currency: string;
  discountAmount: number;
  status: string;
  accessCode: string | null;
  stripeSessionId: string | null;
  createdAt: string;
}

const SORT_OPTIONS = [
  { value: "date_desc",   label: "Più recenti" },
  { value: "date_asc",    label: "Più vecchi" },
  { value: "amount_desc", label: "Importo maggiore" },
  { value: "amount_asc",  label: "Importo minore" },
  { value: "name_az",     label: "Cliente A→Z" },
];

const STATUS_FILTERS = [
  { value: "all",       label: "Tutti" },
  { value: "completed", label: "Completati" },
  { value: "pending",   label: "Pending" },
];

export default function AdminPurchases() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("all");
  const [courseFilter, setCourse]   = useState("all");
  const [sort, setSort]             = useState("date_desc");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [user, authLoading, setLocation]);

  const { data: purchases = [], isLoading } = useQuery<Purchase[]>({
    queryKey: ["admin", "purchases"],
    queryFn: () => fetchApi<Purchase[]>("/admin/purchases"),
  });

  const courseOptions = useMemo(() => {
    const seen = new Map<string, string>();
    purchases.forEach((p) => seen.set(String(p.courseId), p.courseTitle));
    return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
  }, [purchases]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = purchases.filter((p) => {
      if (q && !p.customerName?.toLowerCase().includes(q) && !p.customerEmail?.toLowerCase().includes(q) && !p.courseTitle?.toLowerCase().includes(q) && !p.accessCode?.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (courseFilter !== "all" && String(p.courseId) !== courseFilter) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "date_desc")   return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "date_asc")    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "amount_desc") return b.amountPaid - a.amountPaid;
      if (sort === "amount_asc")  return a.amountPaid - b.amountPaid;
      if (sort === "name_az")     return (a.customerName || "").localeCompare(b.customerName || "", "it");
      return 0;
    });
    return list;
  }, [purchases, search, statusFilter, courseFilter, sort]);

  const totalRevenue   = filtered.reduce((s, p) => s + p.amountPaid, 0);
  const withDiscount   = filtered.filter((p) => p.discountAmount > 0).length;
  const hasActiveFilters = search || statusFilter !== "all" || courseFilter !== "all" || sort !== "date_desc";

  const resetFilters = () => { setSearch(""); setStatus("all"); setCourse("all"); setSort("date_desc"); };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Codice copiato!" });
  };

  if (authLoading) return null;

  return (
    <div className="flex min-h-screen bg-background text-white">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wider">Acquisti</h1>
            <p className="text-muted-foreground mt-1 text-sm">Acquisti completati tramite Stripe</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-card border border-white/10 rounded-xl p-4">
              <p className="text-muted-foreground text-xs">Totale</p>
              <p className="text-2xl font-bold mt-1 text-white">{purchases.length}</p>
            </div>
            <div className="bg-card border border-white/10 rounded-xl p-4">
              <p className="text-muted-foreground text-xs">Filtrati</p>
              <p className="text-2xl font-bold mt-1 text-green-400">{filtered.length}</p>
            </div>
            <div className="bg-card border border-white/10 rounded-xl p-4">
              <p className="text-muted-foreground text-xs">Ricavi (filtrati)</p>
              <p className="text-2xl font-bold mt-1 text-primary">€{totalRevenue.toFixed(2)}</p>
            </div>
            <div className="bg-card border border-white/10 rounded-xl p-4">
              <p className="text-muted-foreground text-xs">Con sconto</p>
              <p className="text-2xl font-bold mt-1 text-amber-400">{withDiscount}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-card/40 border border-white/8 rounded-xl p-4 mb-5 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per cliente, email, corso, codice..."
                className="w-full bg-background border border-white/10 text-white pl-9 pr-9 py-2.5 text-sm rounded-lg placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Row 2: Status + Course + Sort + Reset */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Status filter */}
              <div className="flex items-center gap-1">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatus(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${statusFilter === f.value ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-white/50 hover:text-white border border-transparent"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-white/10 hidden sm:block" />

              {/* Course filter */}
              {courseOptions.length > 1 && (
                <select
                  value={courseFilter}
                  onChange={(e) => setCourse(e.target.value)}
                  className="bg-background border border-white/10 text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-primary/50"
                >
                  <option value="all">Tutti i corsi</option>
                  {courseOptions.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              )}

              {/* Sort */}
              <div className="flex items-center gap-1.5 ml-auto">
                <ArrowUpDown size={13} className="text-white/30" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="bg-background border border-white/10 text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-primary/50"
                >
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Reset */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <X size={12} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs text-white/30 mb-4">
            {isLoading ? "Caricamento…" : `${filtered.length} acquist${filtered.length === 1 ? "o" : "i"} trovati`}
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => <div key={i} className="h-24 bg-card/40 rounded-xl animate-pulse border border-white/5" />)}
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingCart size={40} className="mx-auto mb-4 opacity-40" />
              <p>Nessun acquisto ancora.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <SlidersHorizontal size={36} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm">Nessun acquisto corrisponde ai filtri applicati.</p>
              <button onClick={resetFilters} className="mt-3 text-primary hover:underline text-sm">Azzera filtri</button>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filtered.map((p) => (
                  <div key={p.id} className="bg-card border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{p.customerName}</p>
                        <p className="text-muted-foreground text-xs truncate">{p.customerEmail}</p>
                      </div>
                      <span className="flex items-center gap-1 text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full text-xs font-medium shrink-0">
                        <CheckCircle size={10} /> {p.status === "completed" ? "Completato" : p.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate max-w-[60%] text-xs">{p.courseTitle}</span>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-white">€{p.amountPaid.toFixed(2)}</span>
                        {p.discountAmount > 0 && <div className="text-xs text-green-400">-€{p.discountAmount.toFixed(2)}</div>}
                      </div>
                    </div>
                    {p.accessCode && (
                      <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg px-3 py-2">
                        <span className="font-mono text-primary font-bold tracking-widest text-sm">{p.accessCode}</span>
                        <button onClick={() => copyCode(p.accessCode!)} className="text-muted-foreground hover:text-white transition-colors ml-2"><Copy size={14} /></button>
                      </div>
                    )}
                    <p className="text-muted-foreground text-xs">{new Date(p.createdAt).toLocaleString("it-IT")}</p>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-card border border-white/10 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Cliente</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Corso</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Importo</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Stato</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Codice Accesso</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{p.customerName}</div>
                          <div className="text-muted-foreground text-xs">{p.customerEmail}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-sm max-w-[180px] truncate">{p.courseTitle}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">€{p.amountPaid.toFixed(2)}</div>
                          {p.discountAmount > 0 && <div className="text-xs text-green-400">-€{p.discountAmount.toFixed(2)}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full text-xs font-medium w-fit">
                            <CheckCircle size={10} /> {p.status === "completed" ? "Completato" : p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.accessCode ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-primary font-bold tracking-widest">{p.accessCode}</span>
                              <button onClick={() => copyCode(p.accessCode!)} className="text-muted-foreground hover:text-white transition-colors"><Copy size={14} /></button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(p.createdAt).toLocaleString("it-IT")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
