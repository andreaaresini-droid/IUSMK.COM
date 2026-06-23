import { LegalLayout, LegalSection, LegalList } from "@/components/layout/LegalLayout";
import { useLang } from "@/i18n/LanguageContext";

export default function DeleteAccount() {
  const { t } = useLang();
  const d = t.deleteAccountPage;
  return (
    <LegalLayout title={d.title} lastUpdated={d.lastUpdated}>

      <p>
        {d.introPre}<code className="text-primary">com.iusmk.app</code>{d.introMid}
        <a href="https://iusmk.com" className="text-primary hover:underline">iusmk.com</a>{d.introPost}
      </p>

      <LegalSection title={d.s1Title}>
        <p>
          {d.s1P1Pre}
          <a href="/account" className="text-primary hover:underline">{d.s1AccountLink}</a>
          {d.s1P1Post}
        </p>
        <p>
          {d.s1P2Pre}
          <a href="mailto:iusmkbarber@gmail.com?subject=Richiesta%20eliminazione%20account%20IUSMK"
             className="text-primary hover:underline">iusmkbarber@gmail.com</a>
          {d.s1P2Post}
        </p>
      </LegalSection>

      <LegalSection title={d.s2Title}>
        <p>{d.s2Body}</p>
        <LegalList items={[...d.s2Items]} />
      </LegalSection>

      <LegalSection title={d.s3Title}>
        <p>{d.s3Body}</p>
        <LegalList items={[...d.s3Items]} />
        <p>{d.s3Note}</p>
      </LegalSection>

      <LegalSection title={d.s4Title}>
        <p>
          {d.s4P1Pre}
          <a href="mailto:iusmkbarber@gmail.com" className="text-primary hover:underline">iusmkbarber@gmail.com</a>{d.s4P1Post}
        </p>
        <p>
          {d.s4P2Pre}
          <a href="/privacy" className="text-primary hover:underline">{d.s4PrivacyLink}</a>{d.s4P2Post}
        </p>
      </LegalSection>

    </LegalLayout>
  );
}
