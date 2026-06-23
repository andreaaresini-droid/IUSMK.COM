import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Loader2, Eye, EyeOff, ShoppingCart, CheckCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

export default function Register() {
  const [, setLocation] = useLocation();
  const { t } = useLang();
  const tr = t.auth.register;

  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registerPending, setRegisterPending] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registered, setRegistered] = useState(false);
  const hasCourseRedirect = typeof window !== "undefined" && !!sessionStorage.getItem("checkout_redirect");

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = tr.errors.firstName;
    if (!form.lastName.trim()) e.lastName = tr.errors.lastName;
    if (!form.email.trim()) e.email = tr.errors.email;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = tr.errors.emailInvalid;
    if (!form.password) e.password = tr.errors.password;
    else if (form.password.length < 6) e.password = tr.errors.passwordShort;
    if (form.password !== form.confirmPassword) e.confirmPassword = tr.errors.confirmMismatch;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setRegisterPending(true);
    setRegisterError("");
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const res = await fetch(`${apiBase}/api/auth/customer/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRegisterError(data.message || tr.failed);
        return;
      }
      setRegistered(true);
      setTimeout(() => setLocation("/login"), 3000);
    } catch {
      setRegisterError(tr.connection);
    } finally {
      setRegisterPending(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full bg-background border rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors ${errors[field] ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-primary"}`;

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-md mx-auto">
          {!registered && hasCourseRedirect && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl px-5 py-4 mb-6 flex gap-3">
              <ShoppingCart className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-white text-sm font-semibold mb-1">{t.auth.buyBadge.registerTitle}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t.auth.buyBadge.registerDesc}
                </p>
              </div>
            </div>
          )}

          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-primary mb-3">
              {tr.title}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {tr.subtitle}
            </p>
          </div>

          {registered ? (
            <div className="bg-card border border-white/10 rounded-2xl p-8 text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle size={56} className="text-primary" />
              </div>
              <p className="text-white font-semibold text-xl">{tr.successTitle}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {tr.successDesc}
              </p>
              <p className="text-muted-foreground text-xs">{tr.redirecting}</p>
              <Link href="/login" className="inline-block text-sm text-primary hover:underline mt-2">
                {tr.goLogin}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-card border border-white/10 rounded-2xl p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{tr.firstName}</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder={tr.firstNamePlaceholder}
                    className={inputClass("firstName")}
                    autoComplete="given-name"
                  />
                  {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{tr.lastName}</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder={tr.lastNamePlaceholder}
                    className={inputClass("lastName")}
                    autoComplete="family-name"
                  />
                  {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>}
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{tr.email}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={tr.emailPlaceholder}
                  className={inputClass("email")}
                  autoComplete="email"
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{tr.password}</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={tr.passwordPlaceholder}
                    className={inputClass("password") + " pr-10"}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{tr.confirmPassword}</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder={tr.confirmPlaceholder}
                  className={inputClass("confirmPassword")}
                  autoComplete="new-password"
                />
                {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>

              {registerError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                  {registerError}
                </div>
              )}

              <button
                type="submit"
                disabled={registerPending}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-semibold text-base transition-colors disabled:opacity-60"
              >
                {registerPending ? (
                  <><Loader2 size={18} className="animate-spin" /> {tr.submitting}</>
                ) : (
                  tr.submit
                )}
              </button>

              <p className="text-center text-sm text-muted-foreground">
                {tr.haveAccount}{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  {tr.login}
                </Link>
              </p>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
