import { Link } from "wouter";
import { LegalLayout, LegalSection, LegalList } from "@/components/layout/LegalLayout";
import { useLang } from "@/i18n/LanguageContext";

export default function Privacy() {
  const { t } = useLang();
  const p = t.privacy;
  return (
    <LegalLayout title={p.title} lastUpdated={p.lastUpdated}>

      <p>{p.intro}</p>

      <LegalSection title={p.controllerTitle}>
        <p>{p.controller}</p>
        <p>{p.emailLabel} <a href="mailto:iusmkbarber@gmail.com" className="text-primary hover:underline">iusmkbarber@gmail.com</a></p>
      </LegalSection>

      {p.sections.map((s) => (
        <LegalSection key={s.title} title={s.title}>
          {s.p.map((testo) => <p key={testo}>{testo}</p>)}
          {s.items.length > 0 && <LegalList items={[...s.items]} />}
        </LegalSection>
      ))}

      <LegalSection title={p.cookieTitle}>
        <p>{p.cookiePre}<Link href="/cookie-policy" className="text-primary hover:underline">{p.cookieLink}</Link>{p.cookiePost}</p>
      </LegalSection>

      <LegalSection title={p.updatesTitle}>
        <p>{p.updatesBody}</p>
      </LegalSection>

    </LegalLayout>
  );
}
