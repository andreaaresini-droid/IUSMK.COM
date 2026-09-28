import { Link } from "wouter";
import { LegalLayout, LegalSection, LegalList } from "@/components/layout/LegalLayout";
import { useLang } from "@/i18n/LanguageContext";

export default function CookiePolicy() {
  const { t } = useLang();
  const c = t.cookiePolicy;
  return (
    <LegalLayout title={c.title} lastUpdated={c.lastUpdated}>

      <p>{c.intro}</p>

      {c.sections.map((s) => (
        <LegalSection key={s.title} title={s.title}>
          {s.p.map((testo) => <p key={testo}>{testo}</p>)}
          {s.items.length > 0 && <LegalList items={[...s.items]} />}
        </LegalSection>
      ))}

      <p>{c.privacyPre}<Link href="/privacy" className="text-primary hover:underline">{c.privacyLink}</Link>{c.privacyPost}</p>

    </LegalLayout>
  );
}
