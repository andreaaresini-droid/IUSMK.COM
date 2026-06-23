import { LegalLayout, LegalSection, LegalList } from "@/components/layout/LegalLayout";
import { useLang } from "@/i18n/LanguageContext";

export default function CookiePolicy() {
  const { t } = useLang();
  const c = t.cookiePolicy;
  return (
    <LegalLayout title={c.title} lastUpdated={c.lastUpdated}>

      <p>{c.intro}</p>

      <LegalSection title={c.s1Title}>
        <p>{c.s1Body}</p>
      </LegalSection>

      <LegalSection title={c.s2Title}>
        <p>{c.s2Body}</p>
        <LegalList items={[...c.s2Items]} />
      </LegalSection>

      <LegalSection title={c.s3Title}>
        <p>{c.s3Body}</p>
      </LegalSection>

      <LegalSection title={c.s4Title}>
        <p>{c.s4Body}</p>
      </LegalSection>

      <LegalSection title={c.s5Title}>
        <p>{c.s5Body}</p>
      </LegalSection>

    </LegalLayout>
  );
}
