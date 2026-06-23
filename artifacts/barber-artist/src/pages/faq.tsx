import { LegalLayout } from "@/components/layout/LegalLayout";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/i18n/LanguageContext";

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
  const { t } = useLang();
  return (
    <LegalLayout title={t.faq.title}>
      <p>{t.faq.intro}</p>

      <div className="space-y-3 mt-6">
        {t.faq.items.map((faq, i) => (
          <FaqItem key={i} question={faq.q} answer={faq.a} />
        ))}
      </div>

      <div className="mt-10 bg-card/40 border border-white/8 rounded-xl p-5 text-center">
        <p className="text-sm text-white/50 mb-2">{t.faq.noAnswer}</p>
        <a
          href="mailto:iusmkbarber@gmail.com"
          className="inline-flex items-center gap-2 text-primary font-semibold hover:underline text-sm"
        >
          {t.faq.writeTo}
        </a>
      </div>
    </LegalLayout>
  );
}
