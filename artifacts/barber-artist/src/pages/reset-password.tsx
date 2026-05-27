import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { fetchApi } from "@/lib/api-client";
import { Loader2, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";

// ── Read token from URL — robust multi-method approach ───────────────────────
// Never calls any backend endpoint at page load.
// Token must be present in URL for the form to appear.
function readTokenFromUrl(): string {
  // Primary: standard query string (?token=...)
  const searchToken = new URLSearchParams(window.location.search).get("token") ?? "";
  if (searchToken) {
    console.log("[RESET_PAGE] token letto da URL (search param):", searchToken.slice(0, 8) + "..., lunghezza:", searchToken.length);
    return searchToken.replace(/\s+/g, ""); // strip any whitespace from email encoding
  }

  // Fallback: check if token is in the hash (some email clients mangle URLs)
  // e.g. /#/reset-password?token=... or #?token=...
  const hashPart = window.location.hash;
  if (hashPart.includes("token=")) {
    const hashToken = new URLSearchParams(hashPart.replace(/^#\/?/, "").replace(/^.*\?/, "?")).get("token") ?? "";
    if (hashToken) {
      console.log("[RESET_PAGE] token letto da URL (hash fallback):", hashToken.slice(0, 8) + "..., lunghezza:", hashToken.length);
      return hashToken.replace(/\s+/g, "");
    }
  }

  console.log("[RESET_PAGE] token mancante — URL search:", window.location.search, "hash:", window.location.hash);
  return "";
}

export default function ResetPassword() {
  const [, setLocation] = useLocation();

  // Token is read ONCE on component creation — no API call, no side effects
  const rawToken = readTokenFromUrl();

  if (rawToken) {
    console.log("[RESET_PAGE] token valido: SÌ (lunghezza ok, form mostrato)");
  } else {
    console.log("[RESET_PAGE] token valido: NO — nessun token nell'URL");
  }

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.password) e.password = "La password è obbligatoria";
    else if (form.password.length < 6) e.password = "La password deve essere di almeno 6 caratteri";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Le password non coincidono";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  // POST: validates AND consumes the token — only on user-initiated submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError("");

    console.log("[RESET_PAGE] submit avviato — invio token al backend, lunghezza:", rawToken.length);

    try {
      await fetchApi("/auth/customer/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: rawToken, password: form.password }),
      }, false);

      console.log("[RESET_PAGE] reset completato con successo");
      setSuccess(true);
      setTimeout(() => setLocation("/login"), 4000);
    } catch (err: any) {
      const msg: string = err?.message ?? "Errore durante il reset della password";
      console.log("[RESET_PAGE] errore ricevuto dal server:", msg);
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full bg-background border rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors ${fieldErrors[field] ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-primary"}`;

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-primary mb-3">
              Imposta una nuova password
            </h1>
            <p className="text-muted-foreground text-sm">
              Scegli una nuova password per il tuo account IUSMK Academy.
            </p>
          </div>

          <div className="bg-card border border-white/10 rounded-2xl p-8">

            {/* ── Success ── */}
            {success && (
              <div className="text-center space-y-4">
                <CheckCircle size={48} className="text-primary mx-auto" />
                <p className="text-white font-medium text-lg">Password aggiornata!</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  La password è stata aggiornata. Ora puoi accedere al tuo account.
                </p>
                <p className="text-muted-foreground text-xs">Reindirizzamento al login in corso...</p>
                <Link href="/login" className="inline-block text-sm text-primary hover:underline mt-2">
                  Vai al login ora →
                </Link>
              </div>
            )}

            {/* ── No token in URL ── */}
            {!success && !rawToken && (
              <div className="text-center space-y-4">
                <XCircle size={48} className="text-red-400 mx-auto" />
                <p className="text-red-400 font-medium">
                  Il link non è valido. Usa il link ricevuto via email.
                </p>
                <Link href="/forgot-password" className="inline-block text-sm text-primary hover:underline mt-2">
                  Richiedi un nuovo link di recupero
                </Link>
              </div>
            )}

            {/* ── Form: token present → show form immediately, no pre-validation ── */}
            {!success && rawToken && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Nuova password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Minimo 6 caratteri"
                      className={inputClass("password") + " pr-10"}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Conferma nuova password</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Ripeti la password"
                    className={inputClass("confirmPassword")}
                    autoComplete="new-password"
                    required
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="text-red-400 text-xs mt-1">{fieldErrors.confirmPassword}</p>
                  )}
                </div>

                {submitError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm space-y-2">
                    <p>{submitError}</p>
                    <Link href="/forgot-password" className="text-primary hover:underline text-xs">
                      Richiedi un nuovo link di recupero →
                    </Link>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !form.password || !form.confirmPassword}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-semibold text-base transition-colors disabled:opacity-60"
                >
                  {submitting ? (
                    <><Loader2 size={18} className="animate-spin" /> Salvataggio...</>
                  ) : (
                    "Salva nuova password"
                  )}
                </button>
              </form>
            )}

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
