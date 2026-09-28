import { Link } from "wouter";
import { LegalLayout, LegalSection, LegalList } from "@/components/layout/LegalLayout";
import { useLang } from "@/i18n/LanguageContext";

export default function Returns() {
  const { t } = useLang();
  const r = t.returns;
  return (
    <LegalLayout title={r.title} lastUpdated={r.lastUpdated}>

      <p>{r.intro}</p>

      {/* Funzione di recesso online: sempre raggiungibile */}
      <div className="bg-card/50 border border-primary/30 rounded-xl p-5 space-y-3">
        <p className="text-white font-semibold">{r.ctaTitle}</p>
        <p>{r.ctaBody}</p>
        <Link
          href="/recesso"
          className="inline-flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-sm transition-colors"
        >
          {r.ctaButton}
        </Link>
      </div>

      {r.sections.map((s) => (
        <LegalSection key={s.title} title={s.title}>
          {s.p.map((testo) => <p key={testo}>{testo}</p>)}
          {s.items.length > 0 && <LegalList items={[...s.items]} />}
        </LegalSection>
      ))}

      <div className="mt-8 bg-card/50 border border-primary/20 rounded-xl p-5">
        <p className="text-sm text-white/60 mb-1">{r.contactLabel}</p>
        <a href="mailto:iusmkbarber@gmail.com" className="text-primary font-semibold hover:underline text-base">
          iusmkbarber@gmail.com
        </a>
      </div>

    </LegalLayout>
  );
}
