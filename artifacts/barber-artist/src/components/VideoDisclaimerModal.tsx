import { ShieldAlert } from "lucide-react";

interface VideoDisclaimerModalProps {
  onConfirm: () => void;
}

export function VideoDisclaimerModal({ onConfirm }: VideoDisclaimerModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <div
        className="relative bg-[#141414] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Red accent top bar */}
        <div className="h-1 rounded-t-2xl bg-primary w-full" />

        <div className="p-6 sm:p-8 flex flex-col gap-5">
          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base md:text-lg leading-snug uppercase tracking-wide">
                Avviso importante sui contenuti del corso
              </h2>
            </div>
          </div>

          {/* Body text */}
          <div className="text-sm text-white/65 leading-relaxed space-y-3 pl-[60px]">
            <p>
              I video corsi di <strong className="text-white/90">Giuseppe Musto</strong> sono riservati
              esclusivamente alla visione personale dell'utente autorizzato.
            </p>
            <p>
              È <strong className="text-white/90">severamente vietato</strong> registrare, salvare, duplicare,
              condividere, distribuire o diffondere in qualsiasi modo i contenuti video del corso,
              integralmente o parzialmente, senza autorizzazione.
            </p>
            <p>
              Qualsiasi uso non autorizzato dei contenuti potrà comportare la{" "}
              <strong className="text-white/90">revoca dell'accesso al corso</strong> e l'adozione dei
              provvedimenti consentiti dalla legge.
            </p>
          </div>

          {/* CTA */}
          <div className="pl-[60px]">
            <button
              onClick={onConfirm}
              className="w-full sm:w-auto h-11 px-8 bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-bold text-sm uppercase tracking-widest rounded-lg transition-all duration-150 select-none"
            >
              Ho capito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
