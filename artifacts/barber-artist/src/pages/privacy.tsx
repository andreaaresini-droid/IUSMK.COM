import { LegalLayout, LegalSection, LegalList } from "@/components/layout/LegalLayout";
import { useLang } from "@/i18n/LanguageContext";

export default function Privacy() {
  const { t } = useLang();
  const p = t.privacy;
  return (
    <LegalLayout title={p.title} lastUpdated={p.lastUpdated}>

      <p>{p.intro}</p>

      <LegalSection title={p.s1Title}>
        <p>{p.s1Controller}</p>
        <p>{p.s1EmailLabel} <a href="mailto:iusmkbarber@gmail.com" className="text-primary hover:underline">iusmkbarber@gmail.com</a></p>
      </LegalSection>

      <LegalSection title={p.s2Title}>
        <p>{p.s2Body}</p>
        <LegalList items={[...p.s2Items]} />
      </LegalSection>

      <LegalSection title={p.s3Title}>
        <p>{p.s3Body}</p>
        <LegalList items={[...p.s3Items]} />
      </LegalSection>

      <LegalSection title={p.s4Title}>
        <p>{p.s4Body}</p>
        <LegalList items={[...p.s4Items]} />
      </LegalSection>

      <LegalSection title={p.s5Title}>
        <p>{p.s5Body}</p>
      </LegalSection>

      <LegalSection title={p.s6Title}>
        <p>{p.s6Body}</p>
      </LegalSection>

      <LegalSection title={p.s7Title}>
        <p>{p.s7Body}</p>
      </LegalSection>

      <LegalSection title={p.s8Title}>
        <p>{p.s8Body}</p>
      </LegalSection>

      <LegalSection title={p.s9Title}>
        <p>{p.s9Pre}<a href="/cookie-policy" className="text-primary hover:underline">{p.s9Link}</a>{p.s9Post}</p>
      </LegalSection>

    </LegalLayout>
  );
}
