import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2, CheckCircle, FileX } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useLang } from "@/i18n/LanguageContext";
import { useCurrentUser } from "@/hooks/use-auth";
import { fetchApi } from "@/lib/api-client";

// ─── Recesso online ───────────────────────────────────────────────────────────
// Funzione di recesso richiesta dal 19/06/2026 (dir. 2023/2673): modulo → secondo
// passo «Conferma il recesso» → ricevuta a schermo con data/ora e numero pratica.
// Non serve essere registrati; se l'utente è connesso, nome ed email sono precompilati.

const inputClass =
  "w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors placeholder-muted-foreground/50";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Ricevuta = { reference: string; receivedAt: string; emailSent: boolean };

export default function Recesso() {
  const { t, lang } = useLang();
  const w = t.withdrawal;
  const { data: user } = useCurrentUser();

  const [form, setForm] = useState({ name: "", email: "", contract: "", purchaseDate: "", notes: "" });
  const [passo, setPasso] = useState<"modulo" | "conferma" | "fatto">("modulo");
  const [errore, setErrore] = useState("");
  const [invio, setInvio] = useState(false);
  const [ricevuta, setRicevuta] = useState<Ricevuta | null>(null);

  // Precompila nome ed email se l'utente è già connesso (senza sovrascrivere)
  useEffect(() => {
    if (user && (user.role === "customer" || user.role === "student")) {
      setForm((f) => ({ ...f, name: f.name || user.name || "", email: f.email || user.email || "" }));
    }
  }, [user]);

  const aggiorna = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const continua = (e: React.FormEvent) => {
    e.preventDefault();
    setErrore("");
    if (!form.name.trim() || !form.email.trim() || !form.contract.trim()) { setErrore(w.required); return; }
    if (!EMAIL_RE.test(form.email.trim())) { setErrore(w.invalidEmail); return; }
    setPasso("conferma");
  };

  const conferma = async () => {
    setErrore("");
    setInvio(true);
    try {
      const r = await fetchApi<Ricevuta>(
        "/withdrawal",
        { method: "POST", body: JSON.stringify({ ...form, confirm: true }) },
        false,
      );
      if (!r?.reference) throw new Error("risposta vuota");
      setRicevuta(r);
      setPasso("fatto");
      window.scrollTo({ top: 0 });
    } catch {
      setErrore(w.error);
    } finally {
      setInvio(false);
    }
  };

  const dataOra = (iso: string) =>
    new Date(iso).toLocaleString(lang === "it" ? "it-IT" : "en-GB", {
      day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const riepilogo = [
    { k: w.nameLabel, v: form.name },
    { k: w.emailLabel, v: form.email },
    { k: w.contractLabel, v: form.contract },
    ...(form.purchaseDate ? [{ k: w.dateLabel, v: form.purchaseDate }] : []),
    ...(form.notes.trim() ? [{ k: w.notesLabel, v: form.notes }] : []),
  ];

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      <Navbar />
      <main className="flex-1 pt-32 pb-20 px-4">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <FileX className="text-primary shrink-0" size={26} aria-hidden="true" />
            <h1 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-wider">{w.title}</h1>
          </div>
          <div className="h-px bg-gradient-to-r from-primary/40 to-transparent mb-6" />

          {passo !== "fatto" && <p className="text-sm text-white/70 leading-relaxed mb-8">{w.intro}</p>}

          {passo === "modulo" && (
            <form onSubmit={continua} noValidate className="bg-card border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5">
              <div>
                <label htmlFor="rec-nome" className="block text-sm text-white/80 mb-2">{w.nameLabel} *</label>
                <input id="rec-nome" autoComplete="name" required maxLength={120} value={form.name} onChange={aggiorna("name")} placeholder={w.namePlaceholder} className={inputClass} />
              </div>
              <div>
                <label htmlFor="rec-email" className="block text-sm text-white/80 mb-2">{w.emailLabel} *</label>
                <input id="rec-email" type="email" autoComplete="email" required maxLength={200} value={form.email} onChange={aggiorna("email")} placeholder={w.emailPlaceholder} className={inputClass} />
              </div>
              <div>
                <label htmlFor="rec-contratto" className="block text-sm text-white/80 mb-2">{w.contractLabel} *</label>
                <input id="rec-contratto" required maxLength={300} value={form.contract} onChange={aggiorna("contract")} placeholder={w.contractPlaceholder} className={inputClass} />
              </div>
              <div>
                <label htmlFor="rec-data" className="block text-sm text-white/80 mb-2">{w.dateLabel}</label>
                <input id="rec-data" type="date" value={form.purchaseDate} onChange={aggiorna("purchaseDate")} className={inputClass} />
              </div>
              <div>
                <label htmlFor="rec-note" className="block text-sm text-white/80 mb-2">{w.notesLabel}</label>
                <textarea id="rec-note" rows={3} maxLength={1000} value={form.notes} onChange={aggiorna("notes")} placeholder={w.notesPlaceholder} className={`${inputClass} resize-none`} />
              </div>

              {errore && <p role="alert" className="text-red-400 text-sm">{errore}</p>}

              <button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-4 rounded-xl font-bold uppercase tracking-wider text-sm transition-colors">
                {w.continue}
              </button>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {w.privacyPre}<Link href="/privacy" className="text-primary hover:underline">{w.privacyLink}</Link>{w.privacyPost}{" "}
                <Link href="/returns" className="text-primary hover:underline">{w.rulesLink}</Link>
              </p>
            </form>
          )}

          {passo === "conferma" && (
            <div className="bg-card border border-primary/30 rounded-2xl p-6 sm:p-8 space-y-5">
              <h2 className="text-lg font-semibold">{w.reviewTitle}</h2>
              <p className="text-sm text-white/70">{w.reviewBody}</p>
              <dl className="border border-white/10 rounded-xl divide-y divide-white/10">
                {riepilogo.map((r) => (
                  <div key={r.k} className="flex justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-white/50">{r.k}</dt>
                    <dd className="text-white font-medium text-right break-words min-w-0">{r.v}</dd>
                  </div>
                ))}
              </dl>

              {errore && <p role="alert" className="text-red-400 text-sm">{errore}</p>}

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => { setErrore(""); setPasso("modulo"); }} disabled={invio}
                  className="sm:w-1/3 border border-white/15 text-white hover:border-white/40 py-4 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                  {w.back}
                </button>
                <button type="button" onClick={conferma} disabled={invio}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 py-4 rounded-xl font-bold uppercase tracking-wider text-sm transition-colors disabled:opacity-60">
                  {invio ? (<><Loader2 size={18} className="animate-spin" /> {w.sending}</>) : w.confirm}
                </button>
              </div>
            </div>
          )}

          {passo === "fatto" && ricevuta && (
            <div className="bg-card border border-green-500/30 rounded-2xl p-6 sm:p-8 space-y-5" role="status">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-green-400 shrink-0" size={28} aria-hidden="true" />
                <h2 className="text-xl font-semibold">{w.doneTitle}</h2>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">{w.doneBody}</p>
              <dl className="border border-white/10 rounded-xl divide-y divide-white/10">
                <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="text-white/50">{w.reference}</dt>
                  <dd className="text-primary font-bold tracking-wider">{ricevuta.reference}</dd>
                </div>
                <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="text-white/50">{w.receivedAt}</dt>
                  <dd className="text-white font-medium text-right">{dataOra(ricevuta.receivedAt)}</dd>
                </div>
                {riepilogo.map((r) => (
                  <div key={r.k} className="flex justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-white/50">{r.k}</dt>
                    <dd className="text-white font-medium text-right break-words min-w-0">{r.v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-white/80">{w.refund}</p>
              <p className="text-xs text-muted-foreground">{ricevuta.emailSent ? w.doneEmail : w.doneNoEmail}</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
