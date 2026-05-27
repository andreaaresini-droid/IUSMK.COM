import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Tag, X, Send, Loader2, Search, Users,
  ExternalLink, Check, ChevronRight, Gift, Calendar,
} from "lucide-react";

interface DiscountCode {
  id: number;
  code: string;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface Account { id: number; name: string; email: string; }

const STRIPE_COUPON_URL = "https://dashboard.stripe.com/acct_1TH79cE4SaTY9Ult/coupons/create";

const EMPTY_CAMPAIGN = {
  code: "",
  discountType: "percentage",
  discountValue: "",
  expiresAt: "",
  customMessage: "",
  mode: "specific" as "specific" | "all",
  selectedIds: [] as number[],
  search: "",
};

function discountLabel(dc: DiscountCode) {
  return dc.discountType === "percentage"
    ? `${dc.discountValue}%`
    : `€${dc.discountValue}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminDiscountCodes() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showCampaign, setShowCampaign] = useState(false);
  const [campaign, setCampaign] = useState(EMPTY_CAMPAIGN);
  const [sendTargetId, setSendTargetId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [user, authLoading, setLocation]);

  const [dcSearch, setDcSearch]     = useState("");
  const [dcFilter, setDcFilter]     = useState("all");
  const [dcSort, setDcSort]         = useState("date_desc");

  const { data: codes = [], isLoading } = useQuery<DiscountCode[]>({
    queryKey: ["admin", "discount-codes"],
    queryFn: () => fetchApi<DiscountCode[]>("/admin/discount-codes"),
  });

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<Account[]>({
    queryKey: ["admin", "accounts-simple"],
    queryFn: () => fetchApi<any[]>("/admin/accounts?filter=all&limit=500").then((r: any) =>
      (Array.isArray(r) ? r : r.accounts ?? []).map((a: any) => ({ id: a.id, name: a.name, email: a.email }))
    ),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetchApi<DiscountCode>("/admin/discount-codes", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (dc: any) => {
      qc.invalidateQueries({ queryKey: ["admin", "discount-codes"] });
      return dc;
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      fetchApi<any>(`/admin/discount-codes/${id}/send`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (res: any) => {
      toast({ title: `Coupon inviato a ${res.sent} utent${res.sent === 1 ? "e" : "i"}!` });
      setShowCampaign(false);
      setSendTargetId(null);
      setCampaign(EMPTY_CAMPAIGN);
    },
    onError: (err: any) => toast({ title: "Errore invio", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/admin/discount-codes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "discount-codes"] });
      toast({ title: "Campagna eliminata" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  const filteredAccounts = accounts.filter((a) =>
    !campaign.search ||
    a.name.toLowerCase().includes(campaign.search.toLowerCase()) ||
    a.email.toLowerCase().includes(campaign.search.toLowerCase())
  );

  const toggleSelect = (id: number) =>
    setCampaign((prev) => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(id)
        ? prev.selectedIds.filter((x) => x !== id)
        : [...prev.selectedIds, id],
    }));

  async function handleSendCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!campaign.code.trim()) {
      toast({ title: "Codice obbligatorio", description: "Inserisci il codice coupon Stripe.", variant: "destructive" });
      return;
    }
    if (campaign.mode === "specific" && campaign.selectedIds.length === 0) {
      toast({ title: "Nessun destinatario", description: "Seleziona almeno un cliente.", variant: "destructive" });
      return;
    }

    // Create the campaign record first
    const dc = await createMutation.mutateAsync({
      code: campaign.code,
      discountType: campaign.discountType,
      discountValue: campaign.discountValue || "0",
      expiresAt: campaign.expiresAt || null,
    });

    if (!dc?.id) return;

    // Then send to selected recipients
    sendMutation.mutate({
      id: dc.id,
      payload: {
        mode: campaign.mode,
        userIds: campaign.mode === "specific" ? campaign.selectedIds : undefined,
        customMessage: campaign.customMessage.trim() || undefined,
      },
    });
  }

  async function handleResend(codeId: number) {
    setSendTargetId(codeId);
  }

  function handleResendSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sendTargetId) return;
    if (campaign.mode === "specific" && campaign.selectedIds.length === 0) {
      toast({ title: "Nessun destinatario", variant: "destructive" });
      return;
    }
    sendMutation.mutate({
      id: sendTargetId,
      payload: {
        mode: campaign.mode,
        userIds: campaign.mode === "specific" ? campaign.selectedIds : undefined,
        customMessage: campaign.customMessage.trim() || undefined,
      },
    });
  }

  if (authLoading) return null;

  const isBusy = createMutation.isPending || sendMutation.isPending;

  return (
    <div className="flex min-h-screen bg-background text-white">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 p-6 md:p-8 pt-20 md:pt-8">
        <div className="max-w-4xl mx-auto">

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-white">Coupon & Codici Sconto</h1>
              <p className="text-muted-foreground mt-1">Crea i coupon su Stripe, poi invia il codice ai tuoi clienti</p>
            </div>
            <button
              onClick={() => { setShowCampaign(true); setSendTargetId(null); setCampaign(EMPTY_CAMPAIGN); }}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus size={16} /> Nuova campagna
            </button>
          </div>

          {/* ── Stripe CTA Banner ── */}
          <a
            href={STRIPE_COUPON_URL}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center justify-between gap-4 bg-gradient-to-r from-[#635BFF]/15 to-[#635BFF]/5 border border-[#635BFF]/30 rounded-2xl px-6 py-5 mb-8 hover:border-[#635BFF]/60 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#635BFF]/20 border border-[#635BFF]/30 flex items-center justify-center shrink-0">
                <Gift size={20} className="text-[#635BFF]" />
              </div>
              <div>
                <p className="font-bold text-white text-base">Crea coupon su Stripe</p>
                <p className="text-sm text-white/50 mt-0.5">
                  Apre la dashboard Stripe → Coupon → Crea nuovo
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[#635BFF] font-semibold text-sm shrink-0 group-hover:translate-x-0.5 transition-transform">
              Apri Stripe
              <ExternalLink size={15} />
            </div>
          </a>

          {/* ── New Campaign Form ── */}
          {showCampaign && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <form
                onSubmit={handleSendCampaign}
                className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90dvh] flex flex-col"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
                  <div>
                    <h3 className="font-bold text-white text-base">Nuova campagna coupon</h3>
                    <p className="text-xs text-white/40 mt-0.5">Invia il codice ai tuoi clienti</p>
                  </div>
                  <button type="button" onClick={() => setShowCampaign(false)} className="text-white/40 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {/* Coupon code */}
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Codice coupon Stripe *</label>
                    <input
                      value={campaign.code}
                      onChange={(e) => setCampaign({ ...campaign, code: e.target.value.toUpperCase() })}
                      placeholder="es. IUSMK20"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-white/30 focus:border-primary/50 outline-none"
                    />
                    <p className="text-xs text-white/30 mt-1">Stesso codice che hai creato su Stripe</p>
                  </div>

                  {/* Discount info (informative) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Tipo sconto</label>
                      <select
                        value={campaign.discountType}
                        onChange={(e) => setCampaign({ ...campaign, discountType: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-primary/50 outline-none"
                      >
                        <option value="percentage">Percentuale (%)</option>
                        <option value="fixed">Importo fisso (€)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">
                        Valore {campaign.discountType === "percentage" ? "(%)" : "(€)"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={campaign.discountValue}
                        onChange={(e) => setCampaign({ ...campaign, discountValue: e.target.value })}
                        placeholder="20"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-primary/50 outline-none"
                      />
                    </div>
                  </div>

                  {/* Expiry */}
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Scadenza (opzionale)</label>
                    <input
                      type="date"
                      value={campaign.expiresAt}
                      onChange={(e) => setCampaign({ ...campaign, expiresAt: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-primary/50 outline-none"
                    />
                  </div>

                  {/* Custom message */}
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Messaggio personalizzato (opzionale)</label>
                    <textarea
                      value={campaign.customMessage}
                      onChange={(e) => setCampaign({ ...campaign, customMessage: e.target.value })}
                      placeholder="Es. Ciao! Ecco un regalo esclusivo per te..."
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-primary/50 outline-none resize-none"
                    />
                  </div>

                  {/* Recipients */}
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Destinatari</p>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setCampaign({ ...campaign, mode: "specific", selectedIds: [] })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          campaign.mode === "specific"
                            ? "bg-primary/15 border-primary/30 text-primary"
                            : "border-white/10 text-white/50 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <Search size={14} /> Clienti specifici
                      </button>
                      <button
                        type="button"
                        onClick={() => setCampaign({ ...campaign, mode: "all", selectedIds: [] })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          campaign.mode === "all"
                            ? "bg-primary/15 border-primary/30 text-primary"
                            : "border-white/10 text-white/50 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <Users size={14} /> Tutti
                      </button>
                    </div>

                    {campaign.mode === "specific" && (
                      <div>
                        <div className="relative mb-2">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                          <input
                            value={campaign.search}
                            onChange={(e) => setCampaign({ ...campaign, search: e.target.value })}
                            placeholder="Cerca per nome o email..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-white/30 focus:border-primary/50 outline-none"
                          />
                        </div>
                        <div className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-white/8 bg-black/20 p-1">
                          {loadingAccounts ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 size={18} className="animate-spin text-white/30" />
                            </div>
                          ) : filteredAccounts.length === 0 ? (
                            <p className="text-center text-xs text-white/30 py-4">Nessun utente trovato</p>
                          ) : filteredAccounts.map((a) => {
                            const sel = campaign.selectedIds.includes(a.id);
                            return (
                              <button
                                type="button"
                                key={a.id}
                                onClick={() => toggleSelect(a.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                                  sel ? "bg-primary/15 border border-primary/20" : "hover:bg-white/5 border border-transparent"
                                }`}
                              >
                                <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                  sel ? "bg-primary border-primary" : "border-white/20"
                                }`}>
                                  {sel && <Check size={10} className="text-white" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm text-white truncate">{a.name}</p>
                                  <p className="text-xs text-white/40 truncate">{a.email}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {campaign.selectedIds.length > 0 && (
                          <p className="text-xs text-primary mt-1.5">
                            {campaign.selectedIds.length} client{campaign.selectedIds.length === 1 ? "e" : "i"} selezionat{campaign.selectedIds.length === 1 ? "o" : "i"}
                          </p>
                        )}
                      </div>
                    )}

                    {campaign.mode === "all" && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-xs text-yellow-400">
                        Il coupon verrà inviato a <strong>tutti gli utenti registrati</strong>.
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-white/8 shrink-0 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCampaign(false)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                  >
                    {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    {campaign.mode === "all" ? "Invia a tutti" : `Invia${campaign.selectedIds.length ? ` (${campaign.selectedIds.length})` : ""}`}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Resend Modal ── */}
          {sendTargetId !== null && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <form
                onSubmit={handleResendSubmit}
                className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-md max-h-[85dvh] flex flex-col"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
                  <div>
                    <h3 className="font-bold text-white text-base">Reinvia coupon</h3>
                    <p className="text-xs font-mono text-primary mt-0.5">
                      {codes.find((c) => c.id === sendTargetId)?.code}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSendTargetId(null)} className="text-white/40 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Destinatari</p>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setCampaign({ ...campaign, mode: "specific", selectedIds: [] })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          campaign.mode === "specific"
                            ? "bg-primary/15 border-primary/30 text-primary"
                            : "border-white/10 text-white/50 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <Search size={14} /> Specifici
                      </button>
                      <button
                        type="button"
                        onClick={() => setCampaign({ ...campaign, mode: "all", selectedIds: [] })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          campaign.mode === "all"
                            ? "bg-primary/15 border-primary/30 text-primary"
                            : "border-white/10 text-white/50 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <Users size={14} /> Tutti
                      </button>
                    </div>
                    {campaign.mode === "specific" && (
                      <div>
                        <div className="relative mb-2">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                          <input
                            value={campaign.search}
                            onChange={(e) => setCampaign({ ...campaign, search: e.target.value })}
                            placeholder="Cerca..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-white/30 focus:border-primary/50 outline-none"
                          />
                        </div>
                        <div className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-white/8 bg-black/20 p-1">
                          {filteredAccounts.map((a) => {
                            const sel = campaign.selectedIds.includes(a.id);
                            return (
                              <button
                                type="button"
                                key={a.id}
                                onClick={() => toggleSelect(a.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                                  sel ? "bg-primary/15 border border-primary/20" : "hover:bg-white/5 border border-transparent"
                                }`}
                              >
                                <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                  sel ? "bg-primary border-primary" : "border-white/20"
                                }`}>
                                  {sel && <Check size={10} className="text-white" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm text-white truncate">{a.name}</p>
                                  <p className="text-xs text-white/40 truncate">{a.email}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {campaign.selectedIds.length > 0 && (
                          <p className="text-xs text-primary mt-1">
                            {campaign.selectedIds.length} selezionat{campaign.selectedIds.length === 1 ? "o" : "i"}
                          </p>
                        )}
                      </div>
                    )}
                    {campaign.mode === "all" && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-xs text-yellow-400">
                        Reinvio a <strong>tutti gli utenti</strong>.
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Messaggio (opzionale)</label>
                    <textarea
                      value={campaign.customMessage}
                      onChange={(e) => setCampaign({ ...campaign, customMessage: e.target.value })}
                      placeholder="Messaggio aggiuntivo..."
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:border-primary/50 outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-white/8 shrink-0 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSendTargetId(null)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={sendMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                  >
                    {sendMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    {campaign.mode === "all" ? "Invia a tutti" : `Invia${campaign.selectedIds.length ? ` (${campaign.selectedIds.length})` : ""}`}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Campaign controls + list ── */}
          {!isLoading && codes.length > 0 && (
            <div className="bg-card/40 border border-white/8 rounded-xl p-4 mb-5 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                  type="text"
                  value={dcSearch}
                  onChange={e => setDcSearch(e.target.value)}
                  placeholder="Cerca codice coupon..."
                  className="w-full bg-background border border-white/10 text-white pl-9 pr-8 py-2.5 text-sm rounded-lg placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
                />
                {dcSearch && (
                  <button onClick={() => setDcSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"><X size={14} /></button>
                )}
              </div>
              {/* Filter chips + sort */}
              <div className="flex flex-wrap gap-1.5 items-center">
                {[{ value: "all", label: "Tutti" }, { value: "active", label: "Attivi" }, { value: "expired", label: "Scaduti" }].map((f) => (
                  <button key={f.value} onClick={() => setDcFilter(f.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${dcFilter === f.value ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-white/50 hover:text-white border border-transparent"}`}>
                    {f.label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1.5">
                  <select value={dcSort} onChange={e => setDcSort(e.target.value)}
                    className="bg-background border border-white/10 text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-primary/50">
                    <option value="date_desc">Più recenti</option>
                    <option value="date_asc">Più vecchi</option>
                    <option value="name_az">Codice A→Z</option>
                    <option value="expires_asc">Scadenza più vicina</option>
                  </select>
                  {(dcSearch || dcFilter !== "all" || dcSort !== "date_desc") && (
                    <button onClick={() => { setDcSearch(""); setDcFilter("all"); setDcSort("date_desc"); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition-colors">
                      <X size={12} /> Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Campaign List ── */}
          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground">
              <Loader2 size={28} className="animate-spin mx-auto mb-3 opacity-40" />
              Caricamento...
            </div>
          ) : codes.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Tag size={40} className="mx-auto mb-4 opacity-30" />
              <p className="text-base font-medium mb-1 text-white/60">Nessuna campagna ancora</p>
              <p className="text-sm text-white/30">Crea un coupon su Stripe, poi clicca "Nuova campagna" per inviarlo ai clienti.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-white/30 uppercase tracking-wider font-medium mb-4">Campagne passate</p>
              {[...codes]
                .filter((code) => {
                  const q = dcSearch.toLowerCase().trim();
                  if (q && !code.code?.toLowerCase().includes(q) && !(code.notes || "").toLowerCase().includes(q)) return false;
                  const expired = code.expiresAt && new Date(code.expiresAt) < new Date();
                  if (dcFilter === "active" && expired) return false;
                  if (dcFilter === "expired" && !expired) return false;
                  return true;
                })
                .sort((a, b) => {
                  if (dcSort === "date_desc")    return (b.id ?? 0) - (a.id ?? 0);
                  if (dcSort === "date_asc")     return (a.id ?? 0) - (b.id ?? 0);
                  if (dcSort === "name_az")      return (a.code || "").localeCompare(b.code || "");
                  if (dcSort === "expires_asc") {
                    if (!a.expiresAt) return 1; if (!b.expiresAt) return -1;
                    return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
                  }
                  return 0;
                })
                .map((code) => {
                const expired = code.expiresAt && new Date(code.expiresAt) < new Date();
                return (
                  <div
                    key={code.id}
                    className="bg-card border border-white/10 rounded-xl px-5 py-4 flex items-center gap-4 flex-wrap sm:flex-nowrap"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Gift size={18} className="text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-primary text-base tracking-widest">{code.code}</span>
                        {expired && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-semibold border border-red-500/20">
                            Scaduto
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-white/40 flex items-center gap-1">
                          <Tag size={10} /> {discountLabel(code)}
                        </span>
                        {code.expiresAt && (
                          <span className="text-xs text-white/40 flex items-center gap-1">
                            <Calendar size={10} /> Scade {fmtDate(code.expiresAt)}
                          </span>
                        )}
                        <span className="text-xs text-white/30">
                          Creato {fmtDate(code.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setSendTargetId(code.id); setCampaign(EMPTY_CAMPAIGN); }}
                        className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Send size={12} /> Reinvia
                        <ChevronRight size={12} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(code.id)}
                        disabled={deleteMutation.isPending}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Elimina campagna"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
