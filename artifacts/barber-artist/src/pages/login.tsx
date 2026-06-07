import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useCustomerLogin, useCurrentUser } from "@/hooks/use-auth";
import { Loader2, Eye, EyeOff, ShoppingCart } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { data: user } = useCurrentUser();
  const customerLogin = useCustomerLogin();

  // Se già loggato, porta alla home
  useEffect(() => {
    if (user && (user.role === "customer" || user.role === "student")) {
      const redirectTo = sessionStorage.getItem("checkout_redirect");
      if (redirectTo) {
        sessionStorage.removeItem("checkout_redirect");
        setLocation(redirectTo);
      } else {
        setLocation("/");
      }
    }
  }, [user]);

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const hasCourseRedirect = typeof window !== "undefined" && !!sessionStorage.getItem("checkout_redirect");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password) return;
    customerLogin.mutate({
      email: form.email.trim().toLowerCase(),
      password: form.password,
    });
  };

  const inputClass = "w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-md mx-auto">
          {hasCourseRedirect && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl px-5 py-4 mb-6 flex gap-3">
              <ShoppingCart className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-white text-sm font-semibold mb-1">Accedi per acquistare il corso</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Per acquistare un corso devi prima accedere o creare un account. Dopo il pagamento riceverai il codice per sbloccare il corso direttamente sul tuo profilo.
                </p>
              </div>
            </div>
          )}

          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-primary mb-3">
              Accedi al tuo account
            </h1>
            <p className="text-muted-foreground text-sm">
              Inserisci le tue credenziali per accedere ai tuoi corsi
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-card border border-white/10 rounded-2xl p-8 space-y-5">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@esempio.com"
                className={inputClass}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="La tua password"
                  className={inputClass + " pr-10"}
                  autoComplete="current-password"
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
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                Password dimenticata?
              </Link>
            </div>

            {customerLogin.isError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                {(customerLogin.error as any)?.message || "Email o password non corretti"}
              </div>
            )}

            <button
              type="submit"
              disabled={customerLogin.isPending || !form.email || !form.password}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-semibold text-base transition-colors disabled:opacity-60"
            >
              {customerLogin.isPending ? (
                <><Loader2 size={18} className="animate-spin" /> Accesso in corso...</>
              ) : (
                "Accedi"
              )}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              Non hai un account?{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">
                Registrati ora
              </Link>
            </p>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
