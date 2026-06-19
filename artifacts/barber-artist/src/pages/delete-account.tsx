import { LegalLayout, LegalSection, LegalList } from "@/components/layout/LegalLayout";

export default function DeleteAccount() {
  return (
    <LegalLayout title="Eliminazione dell'account" lastUpdated="19 giugno 2026">

      <p>
        Questa pagina spiega come richiedere l'eliminazione del tuo account IUSMK e dei dati
        personali associati. Riguarda l'app <strong className="text-white">IUSMK</strong>{" "}
        (identificativo <code className="text-primary">com.iusmk.app</code>) e il sito{" "}
        <a href="https://iusmk.com" className="text-primary hover:underline">iusmk.com</a>,
        gestiti da Giuseppe Musto.
      </p>

      <LegalSection title="1. Come richiedere l'eliminazione">
        <p>
          Per richiedere l'eliminazione del tuo account e dei dati associati, invia una email a{" "}
          <a href="mailto:iusmkbarber@gmail.com?subject=Richiesta%20eliminazione%20account%20IUSMK"
             className="text-primary hover:underline">iusmkbarber@gmail.com</a>{" "}
          dall'indirizzo email che hai usato per registrarti, indicando nell'oggetto
          "Richiesta eliminazione account IUSMK".
        </p>
        <p>
          Per verificare la tua identità potremmo chiederti di confermare la richiesta dall'indirizzo
          email registrato. Una volta verificata, l'account e i dati associati vengono eliminati di
          norma entro <strong className="text-white">30 giorni</strong>. Riceverai una conferma via email.
        </p>
      </LegalSection>

      <LegalSection title="2. Dati che vengono eliminati">
        <p>A seguito della richiesta vengono eliminati i seguenti dati:</p>
        <LegalList items={[
          "dati identificativi e di contatto (nome, email)",
          "credenziali e dati dell'account",
          "cronologia dei corsi e degli accessi associati all'account",
          "messaggi inviati tramite chat o moduli di contatto",
          "token e iscrizioni alle notifiche associati all'account",
        ]} />
      </LegalSection>

      <LegalSection title="3. Dati eventualmente conservati e per quanto tempo">
        <p>
          Alcuni dati possono essere conservati, anche dopo l'eliminazione dell'account, solo dove
          richiesto dalla legge o per la tutela dei diritti del titolare:
        </p>
        <LegalList items={[
          "dati relativi agli acquisti e ai documenti fiscali/contabili: conservati per il periodo previsto dalla normativa fiscale applicabile (in genere 10 anni)",
          "dati minimi necessari a difendere un diritto in sede legale, per il tempo strettamente necessario a tale scopo",
        ]} />
        <p>
          Questi dati residui sono conservati in forma limitata e non vengono più utilizzati per
          erogare il servizio. Decorsi i termini di legge, vengono eliminati o resi anonimi.
        </p>
      </LegalSection>

      <LegalSection title="4. Contatto">
        <p>
          Per qualsiasi richiesta o chiarimento sull'eliminazione dell'account e dei dati puoi
          scrivere a{" "}
          <a href="mailto:iusmkbarber@gmail.com" className="text-primary hover:underline">iusmkbarber@gmail.com</a>.
        </p>
        <p>
          Per maggiori informazioni sul trattamento dei dati consulta la{" "}
          <a href="/privacy" className="text-primary hover:underline">Informativa Privacy</a>.
        </p>
      </LegalSection>

    </LegalLayout>
  );
}
