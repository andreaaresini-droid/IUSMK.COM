import { LegalLayout, LegalSection, LegalList } from "@/components/layout/LegalLayout";
import { useLang } from "@/i18n/LanguageContext";

export default function Returns() {
  const { t } = useLang();
  const r = t.returns;
  return (
    <LegalLayout title={r.title} lastUpdated={r.lastUpdated}>

      <p>{r.introPre}<a href="mailto:iusmkbarber@gmail.com" className="text-primary hover:underline">iusmkbarber@gmail.com</a>.</p>

      <LegalSection title={r.s1Title}>
        <p>{r.s1Body}</p>
      </LegalSection>

      <LegalSection title={r.s2Title}>
        <p>{r.s2Body}</p>
        <LegalList items={[...r.s2Items]} />
      </LegalSection>

      <LegalSection title={r.s3Title}>
        <p>{r.s3Body}</p>
      </LegalSection>

      <LegalSection title={r.s4Title}>
        <p>{r.s4Body}</p>
      </LegalSection>

      <LegalSection title={r.s5Title}>
        <p>{r.s5Body}</p>
      </LegalSection>

      <div className="mt-8 bg-card/50 border border-primary/20 rounded-xl p-5">
        <p className="text-sm text-white/60 mb-1">{r.contactLabel}</p>
        <a href="mailto:iusmkbarber@gmail.com" className="text-primary font-semibold hover:underline text-base">
          iusmkbarber@gmail.com
        </a>
      </div>

    </LegalLayout>
  );
}
