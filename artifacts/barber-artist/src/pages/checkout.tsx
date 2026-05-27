import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useCurrentUser } from "@/hooks/use-auth";
import { useOwnedCourseIds } from "@/hooks/use-courses";
import { CreditCard, Loader2, ChevronLeft, User, BookOpen, CheckCircle } from "lucide-react";
import { fetchApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export default function Checkout() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const courseId = params.get("course");

  const { data: user, isLoading: userLoading } = useCurrentUser();
  // Sia "customer" che "student" possono avere corsi — evita checkout duplicato per entrambi
  const isLoggedInUser = user?.role === "customer" || user?.role === "student";
  const { data: ownedData, isLoading: ownedLoading } = useOwnedCourseIds(isLoggedInUser);
  const ownedIds = new Set<number>(ownedData?.courseIds ?? []);

  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!courseId) { setLocation("/academy"); return; }
    fetch(`/api/courses/${courseId}`)
      .then((r) => r.json())
      .then((data) => { setCourse(data); setLoading(false); })
      .catch(() => { setLoading(false); setLocation("/academy"); });
  }, [courseId]);

  useEffect(() => {
    if (!userLoading && !loading) {
      if (!user) {
        sessionStorage.setItem("checkout_redirect", `/checkout?course=${courseId}`);
        setLocation("/login");
      } else if (user.role === "admin") {
        // Admin non può fare acquisti
        setLocation("/admin");
      }
      // "customer" e "student" possono arrivare qui — il blocco doppio acquisto è gestito sotto
    }
  }, [user, userLoading, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      sessionStorage.setItem("checkout_redirect", `/checkout?course=${courseId}`);
      setLocation("/login");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const token = localStorage.getItem("barber_artist_token");
      const res = await fetch("/api/sumup/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ courseId: course.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore durante il pagamento");
        setSubmitting(false);
        return;
      }
      window.location.href = data.sessionUrl;
    } catch {
      setError("Errore di connessione. Riprova.");
      setSubmitting(false);
    }
  };

  const pageLoading = loading || userLoading || (isLoggedInUser && ownedLoading);

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!course) return null;
  if (!user || user.role === "admin") return null;

  // ── Blocco frontend: corso già posseduto ──────────────────────────────────
  const isOwned = course && ownedIds.has(course.id);
  if (isOwned) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navbar />
        <main className="pt-24 pb-20 px-4">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => setLocation("/academy")}
              className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8 text-sm"
            >
              <ChevronLeft size={16} /> Torna all'Academy
            </button>

            <div className="bg-card border border-green-500/20 rounded-2xl overflow-hidden mb-6">
              {course.thumbnailUrl && (
                <img src={course.thumbnailUrl} alt={course.title} className="w-full h-40 object-cover opacity-60" />
              )}
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-widest text-green-400">Già acquistato</span>
                </div>
                <h2 className="font-display text-xl font-bold uppercase tracking-widest text-white">{course.title}</h2>
                <p className="text-muted-foreground text-sm mt-1">{course.shortDescription}</p>
              </div>
            </div>

            <div className="bg-card border border-white/10 rounded-2xl p-6 mb-5 text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
              <h3 className="text-white font-semibold text-lg">Questo corso è già nel tuo account</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hai già acquistato questo corso. Puoi accedere subito ai contenuti dal tuo portale studente.
              </p>
            </div>

            <Button
              size="lg"
              className="w-full uppercase tracking-wider font-bold"
              onClick={() => setLocation("/dashboard")}
            >
              <BookOpen size={18} className="mr-2" />
              Vai al corso
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => setLocation("/academy")}
            className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8 text-sm"
          >
            <ChevronLeft size={16} /> Torna all'Academy
          </button>

          <div className="bg-card border border-white/10 rounded-2xl overflow-hidden mb-6">
            {course.thumbnailUrl && (
              <img src={course.thumbnailUrl} alt={course.title} className="w-full h-40 object-cover" />
            )}
            <div className="p-6">
              <h2 className="font-display text-xl font-bold uppercase tracking-widest text-primary">{course.title}</h2>
              <p className="text-muted-foreground text-sm mt-1">{course.shortDescription}</p>
            </div>
          </div>

          <div className="bg-card border border-white/10 rounded-2xl p-6 mb-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground mb-2">Account</h3>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              </div>
              <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">Verificato</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-card border border-white/10 rounded-2xl p-6 space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground">Riepilogo</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{course.title}</span>
                <span>€{course.price?.toFixed(2)}</span>
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between font-bold">
                <span>Totale</span>
                <span className="text-primary text-xl">€{course.price?.toFixed(2)}</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-3 bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-semibold text-base transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <><Loader2 size={18} className="animate-spin" /> Reindirizzamento a SumUp...</>
              ) : (
                <><CreditCard size={18} /> Paga €{course.price?.toFixed(2)} con SumUp</>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Pagamento sicuro tramite SumUp. Dopo il pagamento riceverai il codice di accesso via notifica.
            </p>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
