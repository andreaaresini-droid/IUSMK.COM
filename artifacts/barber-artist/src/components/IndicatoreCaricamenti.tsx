import { Loader2, CheckCircle, AlertCircle, WifiOff, X } from "lucide-react";
import { useCaricamenti, togliCaricamento } from "@/lib/caricamenti";

/**
 * Piccolo indicatore sempre visibile (in basso a sinistra) dei caricamenti di
 * foto/video in corso: resta anche se si cambia sezione. Vedi lib/caricamenti.ts.
 */
export function IndicatoreCaricamenti() {
  const caricamenti = useCaricamenti();
  if (caricamenti.length === 0) return null;

  return (
    <div
      className="fixed z-[9500] left-3 bottom-3 flex flex-col gap-2 w-[min(320px,calc(100vw-24px))]"
      role="status"
      aria-live="polite"
    >
      {caricamenti.map((c) => (
        <div
          key={c.id}
          className="bg-[#111] border border-white/10 rounded-xl shadow-2xl px-3.5 py-2.5 text-xs text-white"
        >
          <div className="flex items-center gap-2">
            {c.stato === "in-corso" && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
            {c.stato === "attesa-rete" && <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />}
            {c.stato === "fatto" && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
            {c.stato === "errore" && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
            <span className="font-semibold truncate flex-1">{c.etichetta}</span>
            {c.stato === "in-corso" && c.percento > 0 && <span className="text-white/60">{c.percento}%</span>}
            {(c.stato === "fatto" || c.stato === "errore") && (
              <button
                onClick={() => togliCaricamento(c.id)}
                className="text-white/40 hover:text-white p-0.5"
                aria-label="Chiudi"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="mt-1 text-white/50 leading-snug">
            {c.stato === "in-corso" && (c.passo || "Caricamento in corso…")}
            {c.stato === "attesa-rete" && "Connessione persa: riprendo appena torna la rete."}
            {c.stato === "fatto" && "Caricato e salvato."}
            {c.stato === "errore" && c.errore}
          </p>
          {(c.stato === "in-corso" || c.stato === "attesa-rete") && (
            <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className={c.percento > 0 ? "h-1 bg-primary transition-all" : "h-1 bg-primary animate-pulse"}
                style={{ width: c.percento > 0 ? `${c.percento}%` : "100%" }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
