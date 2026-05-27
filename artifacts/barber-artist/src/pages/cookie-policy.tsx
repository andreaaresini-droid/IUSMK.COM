import { LegalLayout, LegalSection, LegalList } from "@/components/layout/LegalLayout";

export default function CookiePolicy() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="18 aprile 2026">

      <p>Questa Cookie Policy descrive l'uso dei cookie e di eventuali strumenti di tracciamento utilizzati dal sito IUSMK.</p>

      <LegalSection title="1. Cosa sono i cookie">
        <p>I cookie sono piccoli file che vengono salvati sul dispositivo dell'utente durante la navigazione e servono, a seconda dei casi, al funzionamento del sito, alla memorizzazione di preferenze, alla misurazione statistica o ad altre finalità.</p>
      </LegalSection>

      <LegalSection title="2. Tipologie di cookie">
        <p>Il sito può utilizzare:</p>
        <LegalList items={[
          "cookie tecnici o strettamente necessari",
          "cookie di preferenza",
          "cookie statistici o analitici",
          "eventuali cookie di profilazione o di terze parti, se presenti",
        ]} />
      </LegalSection>

      <LegalSection title="3. Gestione del consenso">
        <p>Per i cookie non tecnici, il consenso dell'utente deve essere raccolto secondo modalità conformi alla normativa applicabile. Il sito deve consentire all'utente di accettare, rifiutare o gestire le preferenze dei cookie.</p>
      </LegalSection>

      <LegalSection title="4. Come gestire i cookie">
        <p>L'utente può gestire le proprie preferenze tramite il banner o lo strumento di gestione dei cookie presente sul sito, oltre che tramite le impostazioni del browser.</p>
      </LegalSection>

      <LegalSection title="5. Cookie di terze parti">
        <p>Eventuali servizi di terze parti integrati nel sito possono installare propri cookie secondo le rispettive informative.</p>
      </LegalSection>

    </LegalLayout>
  );
}
