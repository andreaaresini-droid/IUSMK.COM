import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useLocation } from "wouter";
import { XCircle, ArrowLeft } from "lucide-react";

export default function CheckoutCancel() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={40} className="text-red-400" />
          </div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-widest text-white mb-2">
            Pagamento Annullato
          </h1>
          <p className="text-muted-foreground mb-8">
            Il pagamento è stato annullato. Nessun importo è stato addebitato.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => history.back()}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              <ArrowLeft size={18} /> Riprova
            </button>
            <button
              onClick={() => setLocation("/academy")}
              className="w-full text-muted-foreground hover:text-white transition-colors text-sm py-2"
            >
              Torna all'Academy
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
