import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { fetchApi } from "@/lib/api-client";
import { Link2, Plus, Pencil, Trash2, X, Check, ExternalLink, Copy, Search, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentLink {
  id: number;
  name: string;
  paymentLinkUrl: string;
  paymentLinkId: string;
  amount: number | null;
  notes: string | null;
  createdAt: string;
}

const EMPTY = { name: "", paymentLinkUrl: "", paymentLinkId: "", amount: "", notes: "" };

const SORT_OPTIONS = [
  { value: "date_desc", label: "Più recenti" },
  { value: "date_asc",  label: "Più vecchi" },
  { value: "name_az",   label: "Nome A→Z" },
  { value: "name_za",   label: "Nome Z→A" },
  { value: "amount_desc", label: "Importo maggiore" },
  { value: "amount_asc",  label: "Importo minore" },
];

function extractLinkId(url: string): string {
  // Estrae l'ID da URL SumUp tipo: https://pay.sumup.com/b2c/QSTAKM7K
  const m = url.match(/pay\.sumup\.com\/b2c\/([A-Z0-9]+)/i);
  if (m) return m[1];
  // Fallback: ultima parte del path
  const parts = url.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || "";
}

function LinkModal({ link, onClose }: { link: PaymentLink | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(
    link
      ? { name: link.name, paymentLinkUrl: link.paymentLinkUrl, paymentLinkId: link.paymentLinkId, amount: link.amount?.toString() ?? "", notes: link.notes ?? "" }
      : { ...EMPTY }
  );
  const [saving, setSaving] = useState(false);

  function handleUrlBlur(url: string) {
    if (!form.paymentLinkId && url.includes("sumup.com")) {
      setForm(f => ({ ...f, paymentLinkId: extractLinkId(url) }));
    }
  }

  async function save() {
    if (!form.name.trim() || !form.paymentLinkUrl.trim() || !form.paymentLinkId.trim()) {
      toast({ title: "Campi obbligatori mancanti", description: "Nome, URL e ID Payment Link sono richiesti", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const method = link ? "PUT" : "POST";
      const url = link ? `/admin/payment-links/${link.id}` : "/admin/payment-links";
      await fetchApi(url, { method, body: JSON.stringify(form) });
      await qc.invalidateQueries({ queryKey: ["admin", "payment-links"] });
      toast({ title: link ? "Link aggiornato" : "Link salvato" });
      onClose();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-white/10 w-full max-w-lg rounded-lg p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{link ? "Modifica Link" : "Nuovo Link Pagamento"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-white p-1"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Nome identificativo *</label>
            <input
              className="w-full bg-background border border-white/10 text-white px-4 py-2.5 rounded focus:outline-none focus:border-primary placeholder-muted-foreground/40"
              placeholder="es. Taglio Base €29"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">URL Payment Link *</label>
            <input
              className="w-full bg-background border border-white/10 text-white px-4 py-2.5 rounded focus:outline-none focus:border-primary placeholder-muted-foreground/40"
              placeholder="https://pay.sumup.com/b2c/..."
              value={form.paymentLinkUrl}
              onChange={e => setForm(f => ({ ...f, paymentLinkUrl: e.target.value }))}
              onBlur={e => handleUrlBlur(e.target.value)}
            />
            <p className="text-muted-foreground/50 text-xs mt-1">Incollando l'URL, l'ID viene estratto automaticamente.</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">ID Payment Link * <span className="text-primary font-mono">(ID SumUp)</span></label>
            <input
              className="w-full bg-background border border-white/10 text-white px-4 py-2.5 rounded focus:outline-none focus:border-primary placeholder-muted-foreground/40 font-mono"
              placeholder="ID link SumUp (es. QSTAKM7K)"
              value={form.paymentLinkId}
              onChange={e => setForm(f => ({ ...f, paymentLinkId: e.target.value.trim() }))}
            />
            <p className="text-muted-foreground/50 text-xs mt-1">SumUp Dashboard → Payment Links → apri il link → copia l'ID dall'URL.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Importo (€) facoltativo</label>
              <input
                type="number"
                step="0.01"
                className="w-full bg-background border border-white/10 text-white px-4 py-2.5 rounded focus:outline-none focus:border-primary placeholder-muted-foreground/40"
                placeholder="29.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Note facoltative</label>
              <input
                className="w-full bg-background border border-white/10 text-white px-4 py-2.5 rounded focus:outline-none focus:border-primary placeholder-muted-foreground/40"
                placeholder="Corso base..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 border border-white/10 text-muted-foreground py-2.5 rounded hover:bg-white/5 transition-colors text-sm">
            Annulla
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-primary text-white py-2.5 rounded font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check size={16} />
            {saving ? "Salvataggio..." : link ? "Aggiorna" : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPaymentLinks() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; link: PaymentLink | null }>({ open: false, link: null });
  const [deleting, setDeleting] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort]     = useState("date_desc");

  const { data: links = [], isLoading } = useQuery<PaymentLink[]>({
    queryKey: ["admin", "payment-links"],
    queryFn: () => fetchApi("/admin/payment-links"),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = q
      ? links.filter((l) =>
          l.name?.toLowerCase().includes(q) ||
          l.paymentLinkId?.toLowerCase().includes(q) ||
          l.paymentLinkUrl?.toLowerCase().includes(q) ||
          l.notes?.toLowerCase().includes(q)
        )
      : [...links];
    list = list.sort((a, b) => {
      if (sort === "date_desc")    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "date_asc")     return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "name_az")      return a.name.localeCompare(b.name, "it");
      if (sort === "name_za")      return b.name.localeCompare(a.name, "it");
      if (sort === "amount_desc")  return (b.amount ?? 0) - (a.amount ?? 0);
      if (sort === "amount_asc")   return (a.amount ?? 0) - (b.amount ?? 0);
      return 0;
    });
    return list;
  }, [links, search, sort]);

  const hasActiveFilters = search || sort !== "date_desc";

  async function remove(id: number) {
    if (!confirm("Eliminare questo link pagamento?")) return;
    setDeleting(id);
    try {
      await fetchApi(`/admin/payment-links/${id}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["admin", "payment-links"] });
      toast({ title: "Link eliminato" });
    } catch (e: any) {
      toast({ title: "Errore eliminazione", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id).catch(() => {});
    toast({ title: "ID copiato negli appunti" });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 pt-14 md:pt-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Link2 size={22} className="text-primary" />
                Link Pagamenti
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Gestisci i link SumUp. Associali ai corsi per il pagamento tramite SumUp.
              </p>
            </div>
            <button
              onClick={() => setModal({ open: true, link: null })}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded font-bold text-sm hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              <Plus size={16} />
              Nuovo Link
            </button>
          </div>

          {/* Info box */}
          <div className="bg-primary/8 border border-primary/20 rounded-lg p-4 mb-5 text-sm text-muted-foreground">
            <p className="font-semibold text-white mb-1">Come funziona?</p>
            <ol className="space-y-1 list-decimal list-inside text-xs">
              <li>Aggiungi qui i tuoi Payment Link SumUp (URL + ID).</li>
              <li>Quando crei o modifichi un corso, seleziona il link dalla lista.</li>
              <li>Al pagamento, il webhook trova il corso tramite l'ID e assegna automaticamente il codice accesso.</li>
            </ol>
          </div>

          {/* Controls */}
          {links.length > 0 && (
            <div className="bg-card/40 border border-white/8 rounded-xl p-4 mb-5 space-y-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca per nome, ID, URL..."
                  className="w-full bg-background border border-white/10 text-white pl-9 pr-9 py-2.5 text-sm rounded-lg placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 ml-auto">
                  <ArrowUpDown size={13} className="text-white/30" />
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                    className="bg-background border border-white/10 text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-primary/50"
                  >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={() => { setSearch(""); setSort("date_desc"); }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <X size={12} /> Reset
                  </button>
                )}
              </div>
              {(search || sort !== "date_desc") && (
                <p className="text-xs text-white/30">{filtered.length} link trovati</p>
              )}
            </div>
          )}

          {/* List */}
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />)}
            </div>
          ) : links.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground border border-dashed border-white/10 rounded-lg">
              <Link2 size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nessun link salvato</p>
              <p className="text-sm mt-1 opacity-60">Aggiungi il primo link Payment Link SumUp</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed border-white/10 rounded-lg">
              <Search size={36} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nessun link trovato</p>
              <button onClick={() => { setSearch(""); setSort("date_desc"); }} className="mt-3 text-primary hover:underline text-sm">Azzera filtri</button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(link => (
                <div key={link.id} className="bg-card border border-white/8 rounded-lg p-4 sm:p-5 hover:border-white/15 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-white font-semibold text-sm">{link.name}</span>
                        {link.amount != null && (
                          <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-mono font-bold">
                            €{link.amount.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span
                          className="font-mono text-primary/80 flex items-center gap-1 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => copyId(link.paymentLinkId)}
                          title="Copia ID"
                        >
                          {link.paymentLinkId}
                          <Copy size={11} />
                        </span>
                        <a
                          href={link.paymentLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-muted-foreground/60 hover:text-white transition-colors"
                          title="Apri link"
                        >
                          <ExternalLink size={11} />
                          pay.sumup.com
                        </a>
                      </div>
                      {link.notes && (
                        <p className="text-xs text-muted-foreground/50 mt-1 italic">{link.notes}</p>
                      )}
                      <p className="text-[10px] text-white/20 mt-1">{new Date(link.createdAt).toLocaleDateString("it-IT")}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setModal({ open: true, link })}
                        className="p-2 text-muted-foreground hover:text-white hover:bg-white/8 rounded transition-colors"
                        title="Modifica"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => remove(link.id)}
                        disabled={deleting === link.id}
                        className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded transition-colors disabled:opacity-40"
                        title="Elimina"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {modal.open && (
        <LinkModal link={modal.link} onClose={() => setModal({ open: false, link: null })} />
      )}
    </div>
  );
}
