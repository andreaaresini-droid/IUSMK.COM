import { LegalLayout, LegalSection, LegalList } from "@/components/layout/LegalLayout";

export default function Returns() {
  return (
    <LegalLayout title="Resi e Recesso" lastUpdated="18 aprile 2026">

      <p>Se acquisti un corso su IUSMK, puoi richiedere il recesso entro 14 giorni dall'acquisto, contattando Giuseppe tramite email all'indirizzo <a href="mailto:iusmkbarber@gmail.com" className="text-primary hover:underline">iusmkbarber@gmail.com</a>.</p>

      <LegalSection title="1. Termine per il recesso">
        <p>La richiesta di recesso deve essere inviata entro <strong className="text-white">14 giorni</strong> dalla data di acquisto del corso.</p>
      </LegalSection>

      <LegalSection title="2. Come richiedere il recesso">
        <p>Per esercitare il recesso, l'utente deve contattare Giuseppe indicando almeno:</p>
        <LegalList items={[
          "nome e cognome",
          "email usata per l'acquisto",
          "corso acquistato",
          "data di acquisto",
          "richiesta di recesso",
        ]} />
      </LegalSection>

      <LegalSection title="3. Valutazione della richiesta">
        <p>Una volta ricevuta la richiesta, IUSMK verificherà i dati dell'acquisto e fornirà riscontro all'utente nel più breve tempo possibile.</p>
      </LegalSection>

      <LegalSection title="4. Rimborso">
        <p>Se la richiesta di recesso è accolta, il rimborso verrà effettuato con modalità compatibili con il metodo di pagamento utilizzato, salvo diversa comunicazione all'utente.</p>
      </LegalSection>

      <LegalSection title="5. Nota informativa">
        <p>Per IUSMK è prevista la possibilità di richiedere il recesso entro 14 giorni dall'acquisto contattando Giuseppe.</p>
      </LegalSection>

      <div className="mt-8 bg-card/50 border border-primary/20 rounded-xl p-5">
        <p className="text-sm text-white/60 mb-1">Per richiedere il recesso scrivi a:</p>
        <a href="mailto:iusmkbarber@gmail.com" className="text-primary font-semibold hover:underline text-base">
          iusmkbarber@gmail.com
        </a>
      </div>

    </LegalLayout>
  );
}
