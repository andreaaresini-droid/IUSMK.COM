import { LegalLayout, LegalSection, LegalList } from "@/components/layout/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout title="Informativa Privacy" lastUpdated="18 aprile 2026">

      <p>Ai sensi della normativa applicabile in materia di protezione dei dati personali, IUSMK informa gli utenti sulle modalità di trattamento dei dati raccolti tramite il sito.</p>

      <LegalSection title="1. Titolare del trattamento">
        <p>Titolare del trattamento: <strong className="text-white">Giuseppe Musto</strong></p>
        <p>Email di contatto: <a href="mailto:iusmkbarber@gmail.com" className="text-primary hover:underline">iusmkbarber@gmail.com</a></p>
      </LegalSection>

      <LegalSection title="2. Dati trattati">
        <p>IUSMK può trattare i seguenti dati:</p>
        <LegalList items={[
          "dati identificativi e di contatto inseriti in fase di registrazione o acquisto",
          "dati necessari alla gestione dell'account",
          "dati relativi agli acquisti dei corsi",
          "dati inviati tramite moduli di contatto o chat",
          "dati tecnici di navigazione",
        ]} />
      </LegalSection>

      <LegalSection title="3. Finalità del trattamento">
        <p>I dati sono trattati per:</p>
        <LegalList items={[
          "consentire la registrazione e l'accesso al sito",
          "gestire gli acquisti e l'erogazione dei corsi",
          "fornire assistenza agli utenti",
          "gestire richieste di contatto",
          "adempiere a obblighi legali",
          "migliorare il funzionamento del sito, nei limiti consentiti",
        ]} />
      </LegalSection>

      <LegalSection title="4. Base giuridica">
        <p>Il trattamento avviene, a seconda dei casi, per:</p>
        <LegalList items={[
          "esecuzione di un contratto o di misure precontrattuali",
          "adempimento di obblighi legali",
          "consenso, quando richiesto",
          "legittimo interesse, ove applicabile",
        ]} />
      </LegalSection>

      <LegalSection title="5. Modalità del trattamento">
        <p>I dati sono trattati con strumenti informatici e organizzativi idonei a garantirne la sicurezza, la riservatezza e l'integrità.</p>
      </LegalSection>

      <LegalSection title="6. Conservazione dei dati">
        <p>I dati sono conservati per il tempo necessario alle finalità per cui sono raccolti e per l'eventuale ulteriore periodo richiesto dalla legge o necessario alla tutela dei diritti del titolare.</p>
      </LegalSection>

      <LegalSection title="7. Comunicazione dei dati">
        <p>I dati possono essere comunicati a fornitori di servizi tecnici, strumenti di pagamento, hosting, assistenza e altri soggetti che trattano i dati per conto del titolare o come autonomi titolari, nei limiti necessari alla gestione del servizio.</p>
      </LegalSection>

      <LegalSection title="8. Diritti dell'interessato">
        <p>L'utente può esercitare i diritti previsti dalla normativa applicabile, tra cui accesso, rettifica, cancellazione, limitazione, opposizione e, ove previsto, portabilità dei dati, contattando il titolare ai recapiti indicati sopra.</p>
      </LegalSection>

      <LegalSection title="9. Cookie e strumenti di tracciamento">
        <p>Per informazioni sui cookie e sugli strumenti di tracciamento utilizzati dal sito, consulta la <a href="/cookie-policy" className="text-primary hover:underline">Cookie Policy</a>.</p>
      </LegalSection>

    </LegalLayout>
  );
}
