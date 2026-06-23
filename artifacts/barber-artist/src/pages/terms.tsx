import { LegalLayout, LegalSection } from "@/components/layout/LegalLayout";
import { useLang } from "@/i18n/LanguageContext";

export default function Terms() {
  const { t } = useLang();
  const s = t.terms;
  return (
    <LegalLayout title={s.title} lastUpdated={s.lastUpdated}>

      <LegalSection title={s.s1Title}>
        <p>{s.s1Owner}</p>
        <p>{s.s1EmailLabel} <a href="mailto:iusmkbarber@gmail.com" className="text-primary hover:underline">iusmkbarber@gmail.com</a></p>
        <p>{s.s1Support}</p>
      </LegalSection>

      <LegalSection title={s.s2Title}>
        <p>{s.s2Body}</p>
      </LegalSection>

      <LegalSection title={s.s3Title}>
        <p>{s.s3Body}</p>
      </LegalSection>

      <LegalSection title={s.s4Title}>
        <p>{s.s4Body}</p>
      </LegalSection>

      <LegalSection title={s.s5Title}>
        <p>{s.s5Body}</p>
      </LegalSection>

      <LegalSection title={s.s6Title}>
        <p>{s.s6Body}</p>
      </LegalSection>

      <LegalSection title={s.s7Title}>
        <p>{s.s7Body}</p>
      </LegalSection>

      <LegalSection title={s.s7bisTitle}>
        <p>{s.s7bisP1}</p>
        <p>{s.s7bisP2}</p>
        <p>{s.s7bisP3}</p>
      </LegalSection>

      <LegalSection title={s.s8Title}>
        <p>{s.s8Body}</p>
      </LegalSection>

      <LegalSection title={s.s9Title}>
        <p>{s.s9Pre}<a href="/returns" className="text-primary hover:underline">{s.s9Link}</a>{s.s9Post}</p>
      </LegalSection>

      <LegalSection title={s.s10Title}>
        <p>{s.s10Pre}<a href="/legal" className="text-primary hover:underline">{s.s10Link}</a>{s.s10Post}</p>
      </LegalSection>

      <LegalSection title={s.s11Title}>
        <p>{s.s11Pre}<a href="/privacy" className="text-primary hover:underline">{s.s11LinkPrivacy}</a>{s.s11Mid}<a href="/cookie-policy" className="text-primary hover:underline">{s.s11LinkCookie}</a>{s.s11Post}</p>
      </LegalSection>

      <LegalSection title={s.s12Title}>
        <p>{s.s12Body}</p>
      </LegalSection>

    </LegalLayout>
  );
}
