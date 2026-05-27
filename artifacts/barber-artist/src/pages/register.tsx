import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useCustomerRegister, useCurrentUser } from "@/hooks/use-auth";
import { Loader2, Eye, EyeOff, ShoppingCart } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const { data: user } = useCurrentUser();
  const register = useCustomerRegister();

  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasCourseRedirect = typeof window !== "undefined" && !!sessionStorage.getItem("checkout_redirect");

  useEffect(() => {
    if (user && user.role === "customer") {
      const redirectTo = sessionStorage.getItem("checkout_redirect");
      if (redirectTo) {
        sessionStorage.removeItem("checkout_redirect");
        setLocation(redirectTo);
      } else {
        setLocation("/academy");
      }
    }
  }, [user]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "Il nome è obbligatorio";
    if (!form.lastName.trim()) e.lastName = "Il cognome è obbligatorio";
    if (!form.email.trim()) e.email = "L'email è obbligatoria";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email non valida";
    if (!form.password) e.password = "La password è obbligatoria";
    else if (form.password.length < 6) e.password = "La password deve essere di almeno 6 caratteri";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Le password non coincidono";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    register.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
    });
  };

  const inputClass = (field: string) =>
    `w-full bg-background border rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors ${errors[field] ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-primary"}`;

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-md mx-auto">
          {hasCourseRedirect && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl px-5 py-4 mb-6 flex gap-3">
              <ShoppingCart className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-white text-sm font-semibold mb-1">Crea un account per acquistare il corso</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Per acquistare un corso devi prima creare un account o accedere. Dopo il pagamento riceverai il codice per sbloccare il corso direttamente sul tuo profilo.
                </p>
              </div>
            </div>
          )}

          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-primary mb-3">
              Crea il tuo account
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Registrati per acquistare i corsi e accedere alla tua area personale.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-card border border-white/10 rounded-2xl p-8 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Nome *</label>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="Mario"
                  className={inputClass("firstName")}
                  autoComplete="given-name"
                />
                {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Cognome *</label>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Rossi"
                  className={inputClass("lastName")}
                  autoComplete="family-name"
                />
                {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">E-mail *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@esempio.com"
                className={inputClass("email")}
                autoComplete="email"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimo 6 caratteri"
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
              <label className="text-sm text-muted-foreground mb-1 block">Conferma Password *</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Ripeti la password"
                className={inputClass("confirmPassword")}
                autoComplete="new-password"
              />
              {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>

            {register.error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                {(register.error as any).message || "Registrazione fallita. Riprova."}
              </div>
            )}

            <button
              type="submit"
              disabled={register.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-semibold text-base transition-colors disabled:opacity-60"
            >
              {register.isPending ? (
                <><Loader2 size={18} className="animate-spin" /> Creazione account...</>
              ) : (
                "Registrati"
              )}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              Hai già un account?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Accedi
              </Link>
            </p>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
