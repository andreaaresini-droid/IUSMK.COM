import { LegalLayout } from "@/components/layout/LegalLayout";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Dove inserisco il coupon?",
    a: "Il coupon va inserito direttamente nel checkout Stripe, se il corso o il link di pagamento lo prevede. Cerca il campo \"Codice promozionale\" durante il pagamento e inserisci il codice esatto.",
  },
  {
    q: "Posso chiedere il recesso?",
    a: "Sì, per IUSMK è possibile richiedere il recesso entro 14 giorni dall'acquisto. Scrivi a iusmkbarber@gmail.com indicando nome, email dell'acquisto, corso acquistato e data di acquisto.",
  },
  {
    q: "Quando ricevo l'accesso al corso?",
    a: "Dopo il completamento del pagamento e secondo la procedura prevista dal sito. Riceverai le istruzioni per accedere al corso acquistato.",
  },
  {
    q: "Posso usare il coupon più di una volta?",
    a: "Dipende da come è stato configurato il coupon. Alcuni coupon possono avere un solo utilizzo, altri più utilizzi, oppure limiti specifici. Se un coupon non funziona, potrebbe essere scaduto o aver raggiunto il limite di utilizzi.",
  },
  {
    q: "Dove posso contattare IUSMK?",
    a: "Puoi scrivere a iusmkbarber@gmail.com oppure contattare l'account Instagram ufficiale @_iusmk_.",
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/3 transition-colors"
      >
        <span className="text-sm font-semibold text-white leading-snug">{question}</span>
        <ChevronDown
          size={16}
          className={cn("text-white/30 shrink-0 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-white/5">
          <p className="text-sm text-white/60 leading-relaxed pt-3">
            {answer.includes("iusmkbarber@gmail.com") ? (
              <>
                {answer.split("iusmkbarber@gmail.com").map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <a href="mailto:iusmkbarber@gmail.com" className="text-primary hover:underline">
                        iusmkbarber@gmail.com
                      </a>
                    )}
                  </span>
                ))}
              </>
            ) : answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Faq() {
  return (
    <LegalLayout title="FAQ">
      <p>Risposte alle domande più frequenti su corsi, pagamenti e assistenza.</p>

      <div className="space-y-3 mt-6">
        {FAQS.map((faq, i) => (
          <FaqItem key={i} question={faq.q} answer={faq.a} />
        ))}
      </div>

      <div className="mt-10 bg-card/40 border border-white/8 rounded-xl p-5 text-center">
        <p className="text-sm text-white/50 mb-2">Non trovi la risposta che cerchi?</p>
        <a
          href="mailto:iusmkbarber@gmail.com"
          className="inline-flex items-center gap-2 text-primary font-semibold hover:underline text-sm"
        >
          Scrivi a iusmkbarber@gmail.com
        </a>
      </div>
    </LegalLayout>
  );
}
