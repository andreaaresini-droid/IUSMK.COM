import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle, Clock, Copy, ArrowRight, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-auth";

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const sessionId = params.get("session_id");
  const { toast } = useToast();
  const { data: user } = useCurrentUser();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!sessionId) { setLocation("/academy"); return; }
    fetchStatus();
  }, [sessionId]);

  // Poll every 3s for up to ~30s while pending (waiting for webhook)
  useEffect(() => {
    if (data?.status === "pending" && pollCount < 10) {
      const t = setTimeout(() => {
        fetchStatus();
        setPollCount((c) => c + 1);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [data, pollCount]);

  function fetchStatus() {
    fetch(`/api/stripe/checkout/status?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => { setError("Errore nel recupero dell'ordine"); setLoading(false); });
  }

  const copyCode = () => {
    if (data?.accessCode) {
      navigator.clipboard.writeText(data.accessCode);
      toast({ title: "Codice copiato!" });
    }
  };

  if (loading) {
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
          {error ? (
            <div>
              <p className="text-red-400 mb-4">{error}</p>
              <button onClick={() => setLocation("/academy")} className="text-primary hover:underline text-sm">
                Torna all'Academy
              </button>
            </div>

          ) : data?.status === "completed" ? (
            <>
              <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-green-400" />
              </div>
              <h1 className="font-display text-3xl font-bold uppercase tracking-widest text-white mb-2">
                Acquisto Completato!
              </h1>
              <p className="text-muted-foreground mb-8">
                Grazie <strong className="text-white">{data.customerName}</strong>!
                Il tuo accesso al corso <strong className="text-white">{data.courseTitle}</strong> è pronto.
              </p>

              {data.accessCode ? (
                <div className="bg-card border border-primary/20 rounded-2xl p-6 mb-8">
                  <p className="text-sm text-muted-foreground mb-3 uppercase tracking-widest">Il tuo codice di accesso</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-mono text-3xl font-bold text-primary tracking-[0.3em]">
                      {data.accessCode}
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
                    Trovi sempre questo codice anche nella sezione <strong className="text-white">Notifiche</strong> del tuo account.
                  </p>
                </div>
              ) : (
                <div className="bg-card border border-white/10 rounded-2xl p-6 mb-8">
                  <Bell size={24} className="text-primary mx-auto mb-3" />
                  <p className="text-sm text-white font-medium mb-1">Codice in arrivo nelle Notifiche</p>
                  <p className="text-xs text-muted-foreground">
                    Riceverai il codice di accesso nella sezione <strong className="text-white">Notifiche</strong> del tuo account entro pochi istanti.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {user?.role === "customer" && (
                  <button
                    onClick={() => setLocation("/notifications")}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-semibold transition-colors"
                  >
                    <Bell size={18} /> Vai alle Notifiche
                  </button>
                )}
                <button
                  onClick={() => setLocation("/access")}
                  className="w-full flex items-center justify-center gap-2 border border-white/15 hover:border-primary/50 text-white py-3 rounded-xl font-semibold transition-colors text-sm"
                >
                  Inserisci codice e accedi al corso <ArrowRight size={16} />
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
                Il tuo pagamento è stato ricevuto e stiamo elaborando l'acquisto.
                Il codice di accesso arriverà nella sezione <strong className="text-white">Notifiche</strong> del tuo account entro pochi secondi.
              </p>

              {user?.role === "customer" && (
                <button
                  onClick={() => setLocation("/notifications")}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-semibold transition-colors mb-3"
                >
                  <Bell size={18} /> Vai alle Notifiche
                </button>
              )}
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
