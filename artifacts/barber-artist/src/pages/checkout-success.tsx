import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useEffect, useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle, Clock, Copy, ArrowRight, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";

type ConfirmResult = { status: "completed" | "pending"; courseTitle?: string; accessCode?: string | null };

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const ref = new URLSearchParams(search).get("ref");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<"verifying" | "completed" | "pending" | "error">("verifying");
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [error, setError] = useState("");
  const pollRef = useRef(0);

  useEffect(() => {
    if (!ref) { setLocation("/academy"); return; }
    let cancelled = false;

    async function confirm() {
      try {
        const data = await fetchApi<ConfirmResult>("/sumup/confirm", {
          method: "POST",
          body: JSON.stringify({ ref }),
        });
        if (cancelled) return;

        if (data.status === "completed") {
          setResult(data);
          setStatus("completed");
          // Aggiorna le cache così il corso appare subito sbloccato
          queryClient.invalidateQueries({ queryKey: ["customer", "my-courses"] });
          queryClient.invalidateQueries({ queryKey: ["owned-course-ids"] });
          queryClient.invalidateQueries({ queryKey: ["current-user"] });
          return;
        }

        // Ancora pending → riprova fino a ~30s (il pagamento può impiegare qualche secondo)
        if (pollRef.current < 10) {
          pollRef.current += 1;
          setStatus("pending");
          setTimeout(() => { if (!cancelled) confirm(); }, 3000);
        } else {
          setStatus("pending");
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Errore nella verifica del pagamento");
        setStatus("error");
      }
    }

    confirm();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  const copyCode = () => {
    if (result?.accessCode) {
      navigator.clipboard.writeText(result.accessCode);
      toast({ title: "Codice copiato!" });
    }
  };

  if (status === "verifying") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm">Verifico il pagamento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-md mx-auto text-center">
          {status === "error" ? (
            <div>
              <p className="text-red-400 mb-4">{error}</p>
              <p className="text-muted-foreground text-sm mb-6">
                Se hai completato il pagamento, il corso verrà sbloccato a breve. Controlla
                la sezione "I miei corsi" tra qualche istante.
              </p>
              <button onClick={() => setLocation("/my-courses")} className="text-primary hover:underline text-sm">
                Vai a I miei corsi
              </button>
            </div>

          ) : status === "completed" ? (
            <>
              <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-green-400" />
              </div>
              <h1 className="font-display text-3xl font-bold uppercase tracking-widest text-white mb-2">
                Acquisto Completato!
              </h1>
              <p className="text-muted-foreground mb-8">
                Il tuo accesso al corso{" "}
                <strong className="text-white">{result?.courseTitle ?? "acquistato"}</strong>{" "}
                è pronto: lo trovi nella sezione <strong className="text-white">I miei corsi</strong>.
              </p>

              {result?.accessCode && (
                <div className="bg-card border border-primary/20 rounded-2xl p-6 mb-8">
                  <p className="text-sm text-muted-foreground mb-3 uppercase tracking-widest">Il tuo codice di accesso</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-mono text-3xl font-bold text-primary tracking-[0.3em]">
                      {result.accessCode}
                    </span>
                    <button
                      onClick={copyCode}
                      className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-white transition-colors"
                      title="Copia codice"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Trovi questo codice anche nella sezione <strong className="text-white">Notifiche</strong> del tuo account.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => setLocation("/my-courses")}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-semibold transition-colors"
                >
                  <BookOpen size={18} /> Vai a I miei corsi <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => setLocation("/academy")}
                  className="w-full text-muted-foreground hover:text-white transition-colors text-sm py-2"
                >
                  Torna all'Academy
                </button>
              </div>
            </>

          ) : (
            <>
              <div className="w-20 h-20 bg-yellow-500/10 border border-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock size={40} className="text-yellow-400" />
              </div>
              <h1 className="font-display text-2xl font-bold uppercase tracking-widest text-white mb-2">
                Pagamento in verifica
              </h1>
              <p className="text-muted-foreground mb-6">
                Stiamo confermando il pagamento. Se l'hai completato, il corso comparirà
                nella sezione <strong className="text-white">I miei corsi</strong> entro pochi istanti.
              </p>
              <button
                onClick={() => setLocation("/my-courses")}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-semibold transition-colors mb-3"
              >
                <BookOpen size={18} /> Vai a I miei corsi
              </button>
              <button
                onClick={() => setLocation("/academy")}
                className="text-muted-foreground hover:text-white transition-colors text-sm"
              >
                Torna all'Academy
              </button>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
