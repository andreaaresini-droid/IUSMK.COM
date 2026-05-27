import { LegalLayout, LegalSection, LegalList } from "@/components/layout/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout title="Termini e Condizioni" lastUpdated="18 aprile 2026">

      <LegalSection title="1. Titolare del sito">
        <p>Il sito IUSMK è gestito da <strong className="text-white">Giuseppe Musto</strong>.</p>
        <p>Email di contatto: <a href="mailto:iusmkbarber@gmail.com" className="text-primary hover:underline">iusmkbarber@gmail.com</a></p>
        <p>Per assistenza relativa ai corsi e agli acquisti è possibile contattare Giuseppe ai recapiti indicati nella sezione Contatti.</p>
      </LegalSection>

      <LegalSection title="2. Oggetto del servizio">
        <p>IUSMK offre corsi digitali accessibili online. I corsi possono essere acquistati tramite i metodi di pagamento disponibili sul sito o tramite checkout Stripe collegato ai relativi link di pagamento.</p>
      </LegalSection>

      <LegalSection title="3. Registrazione account">
        <p>Per accedere ad alcune funzionalità del sito e ai contenuti acquistati può essere richiesta la creazione di un account personale. L'utente è responsabile della correttezza dei dati inseriti e della riservatezza delle proprie credenziali di accesso.</p>
      </LegalSection>

      <LegalSection title="4. Acquisto dei corsi">
        <p>L'acquisto di un corso si considera concluso al completamento del pagamento. Dopo il pagamento, l'utente riceverà le istruzioni per l'accesso al corso acquistato secondo le modalità previste dalla piattaforma.</p>
      </LegalSection>

      <LegalSection title="5. Prezzi">
        <p>I prezzi dei corsi sono indicati nelle relative pagine o nel checkout. Prima della conferma del pagamento, l'utente visualizza il prezzo complessivo applicabile.</p>
      </LegalSection>

      <LegalSection title="6. Modalità di accesso ai contenuti">
        <p>L'accesso ai corsi può avvenire tramite account utente e, se previsto dalla piattaforma, tramite codice di accesso o procedura di sblocco collegata all'acquisto o all'assegnazione del corso.</p>
      </LegalSection>

      <LegalSection title="7. Utilizzo consentito">
        <p>I contenuti dei corsi sono destinati esclusivamente all'uso personale dell'utente che li ha acquistati o ricevuti legittimamente. È vietata la diffusione non autorizzata dei contenuti, dei materiali didattici, dei video, delle immagini e dei codici di accesso.</p>
      </LegalSection>

      <LegalSection title="7bis. Tutela dei contenuti digitali">
        <p>I contenuti dei corsi, inclusi video, immagini, materiali didattici e altri contenuti digitali messi a disposizione tramite IUSMK, sono destinati esclusivamente all'uso personale dell'utente autorizzato.</p>
        <p>È vietato registrare, salvare, copiare, distribuire, condividere, diffondere, riprodurre o utilizzare in qualsiasi forma non autorizzata i contenuti dei corsi, integralmente o parzialmente.</p>
        <p>La violazione di tali regole può comportare la sospensione o revoca dell'accesso e l'adozione delle misure consentite dalla legge.</p>
      </LegalSection>

      <LegalSection title="8. Modifiche e disponibilità del servizio">
        <p>IUSMK si impegna a mantenere il sito e i contenuti accessibili, salvo esigenze tecniche, manutenzione, aggiornamenti o cause non dipendenti dal gestore.</p>
      </LegalSection>

      <LegalSection title="9. Resi e diritto di recesso">
        <p>Le condizioni relative a resi, rimborsi e diritto di recesso sono disciplinate nella specifica pagina <a href="/returns" className="text-primary hover:underline">Resi e Recesso</a>, che costituisce parte integrante dei presenti Termini.</p>
      </LegalSection>

      <LegalSection title="10. Assistenza">
        <p>Per informazioni, assistenza tecnica, richieste relative agli acquisti o ai corsi, l'utente può contattare IUSMK tramite i recapiti presenti nella sezione <a href="/legal" className="text-primary hover:underline">Contatti</a>.</p>
      </LegalSection>

      <LegalSection title="11. Privacy e cookie">
        <p>Il trattamento dei dati personali è disciplinato dall'<a href="/privacy" className="text-primary hover:underline">Informativa Privacy</a> e dalla <a href="/cookie-policy" className="text-primary hover:underline">Cookie Policy</a> disponibili sul sito.</p>
      </LegalSection>

      <LegalSection title="12. Legge applicabile">
        <p>I presenti Termini e Condizioni sono disciplinati dalla legge italiana, fatti salvi gli eventuali diritti inderogabili riconosciuti ai consumatori dalla normativa applicabile.</p>
      </LegalSection>

    </LegalLayout>
  );
}
