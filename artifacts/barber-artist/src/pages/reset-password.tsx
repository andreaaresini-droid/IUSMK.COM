import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Loader2, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { t } = useLang();
  const tr = t.pwReset.reset;
  const [mode, setMode] = useState<"loading" | "form" | "no-token">("loading");
  const [token, setToken] = useState("");
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawToken = params.get("token");

    if (!rawToken) {
      setMode("no-token");
      return;
    }

    setToken(rawToken);

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
    fetch(`${apiBase}/api/auth/customer/verify-reset-token?token=${encodeURIComponent(rawToken)}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("[reset-password] verify response:", data);
        if (data.valid) {
          setMode("form");
        } else {
          setMode("no-token");
        }
      })
      .catch((err) => {
        console.error("[reset-password] verify fetch error:", err);
        setMode("no-token");
      });
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.password) e.password = tr.errRequired;
    else if (form.password.length < 6) e.password = tr.errShort;
    if (form.password !== form.confirmPassword) e.confirmPassword = tr.errMismatch;
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const res = await fetch(`${apiBase}/api/auth/customer/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.message || tr.updateFailed);
        return;
      }
      setSuccess(true);
      setTimeout(() => setLocation("/login"), 4000);
    } catch {
      setSubmitError(tr.connectionError);
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
              {tr.title}
            </h1>
            <p className="text-muted-foreground text-sm">
              {tr.subtitle}
            </p>
          </div>

          <div className="bg-card border border-white/10 rounded-2xl p-8">

            {mode === "loading" && (
              <div className="text-center py-8">
                <Loader2 size={32} className="animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground text-sm mt-4">{tr.verifying}</p>
              </div>
            )}

            {success && (
              <div className="text-center space-y-4">
                <CheckCircle size={48} className="text-primary mx-auto" />
                <p className="text-white font-medium text-lg">{tr.updatedTitle}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {tr.updatedDesc}
                </p>
                <p className="text-muted-foreground text-xs">{tr.redirecting}</p>
                <Link href="/login" className="inline-block text-sm text-primary hover:underline mt-2">
                  {tr.goLogin}
                </Link>
              </div>
            )}

            {!success && mode === "no-token" && (
              <div className="text-center space-y-4">
                <XCircle size={48} className="text-red-400 mx-auto" />
                <p className="text-red-400 font-medium">
                  {tr.invalidLink}
                </p>
                <p className="text-muted-foreground text-sm">
                  {tr.invalidLinkDesc}
                </p>
                <Link href="/forgot-password" className="inline-block mt-2">
                  <button className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors">
                    {tr.requestNewLink}
                  </button>
                </Link>
              </div>
            )}

            {!success && mode === "form" && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{tr.newPasswordLabel}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder={tr.minChars}
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
                  {fieldErrors.password && <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>}
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{tr.confirmNewLabel}</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder={tr.repeatPlaceholder}
                    className={inputClass("confirmPassword")}
                    autoComplete="new-password"
                    required
                  />
                  {fieldErrors.confirmPassword && <p className="text-red-400 text-xs mt-1">{fieldErrors.confirmPassword}</p>}
                </div>

                {submitError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm space-y-2">
                    <p>{submitError}</p>
                    <Link href="/forgot-password" className="text-primary hover:underline text-xs">
                      {tr.requestNewLinkArrow}
                    </Link>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !form.password || !form.confirmPassword}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-semibold text-base transition-colors disabled:opacity-60"
                >
                  {submitting ? (
                    <><Loader2 size={18} className="animate-spin" /> {tr.saving}</>
                  ) : (
                    tr.saveNew
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
