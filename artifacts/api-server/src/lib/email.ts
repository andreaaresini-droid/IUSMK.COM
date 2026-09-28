import { Resend } from "resend";
import { componiEmail, urlSito, IUSMK_EMAIL_CONTATTO } from "./emailModello";

// ─── Resend (transactional email for Vercel serverless) ───────────────────────
// Required env vars:
//   RESEND_API_KEY  — from resend.com dashboard
//   RESEND_FROM     — verified sender, e.g. "IUSMK Academy <noreply@iusmk.com>"
//   APP_URL         — public frontend URL, e.g. https://iusmk.vercel.app
//
// Tutte le email passano dal modello unico in ./emailModello.ts (stile del sito).

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<{ ok: boolean; result?: any; error?: any }> {
  const resend = getResendClient();
  const from = process.env.RESEND_FROM || "IUSMK Academy <noreply@iusmk.com>";

  console.log("[EMAIL_DEBUG] sendEmail called — to:", to, "subject:", subject);
  console.log("[EMAIL_DEBUG] from:", from);
  console.log("[EMAIL_DEBUG] RESEND_API_KEY presente:", !!process.env.RESEND_API_KEY);

  if (!resend) {
    console.error("[EMAIL_FAIL] RESEND_API_KEY mancante — imposta la variabile in Vercel");
    return { ok: false, error: "missing_resend_api_key" };
  }

  try {
    const { data, error } = await resend.emails.send({ from, to, subject, html, ...(text ? { text } : {}) });
    if (error) {
      console.error("[EMAIL_FAIL] Resend error:", error);
      return { ok: false, error };
    }
    console.log("[EMAIL_OK] email inviata — id:", data?.id);
    return { ok: true, result: data };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("[EMAIL_FAIL] eccezione:", msg);
    return { ok: false, error: msg };
  }
}

function dataOraItaliana(d: Date): string {
  return d.toLocaleString("it-IT", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome",
  });
}

// ─── Purchase confirmation email ─────────────────────────────────────────────

export function buildPurchaseConfirmationEmail(opts: {
  customerName: string;
  courseTitle: string;
  amountPaid: number;
  purchaseDate: Date;
  accessCode: string;
}) {
  const { customerName, courseTitle, amountPaid, purchaseDate, accessCode } = opts;
  const appUrl = urlSito();
  const subject = "Conferma acquisto corso — IUSMK Academy";
  const email = componiEmail({
    anteprima: `Il corso «${courseTitle}» è sbloccato: ecco il riepilogo e il codice di accesso.`,
    titolo: "Pagamento confermato",
    saluto: `Ciao ${customerName},`,
    paragrafi: [
      "il tuo acquisto è andato a buon fine. Qui sotto trovi il riepilogo dell'ordine e il codice per accedere al corso.",
    ],
    codice: { etichetta: "Il tuo codice di accesso", valore: accessCode },
    riepilogo: [
      { etichetta: "Corso", valore: courseTitle },
      { etichetta: "Importo pagato", valore: `€ ${amountPaid.toFixed(2).replace(".", ",")}` },
      { etichetta: "Data acquisto", valore: dataOraItaliana(purchaseDate) },
      { etichetta: "Stato", valore: "Completato" },
    ],
    pulsante: { testo: "Vai ai miei corsi", url: `${appUrl}/my-courses` },
    note: [
      "Come accedere: entra su iusmk.com con il tuo account e apri «I miei corsi»: il corso è già nel tuo profilo. In alternativa usa il codice qui sopra nella sezione «Accedi al corso».",
      `Serve aiuto? Scrivici a ${IUSMK_EMAIL_CONTATTO} o dalla pagina ${appUrl}/contact.`,
    ],
    motivo: "Ricevi questa email perché hai acquistato un corso su IUSMK Academy.",
  });
  return { subject, ...email };
}

export async function sendPurchaseConfirmationEmail(opts: {
  toEmail: string;
  customerName: string;
  courseTitle: string;
  amountPaid: number;
  purchaseDate: Date;
  accessCode: string;
}): Promise<{ ok: boolean; error?: any }> {
  const { toEmail, courseTitle, amountPaid, accessCode } = opts;
  const { subject, html, text } = buildPurchaseConfirmationEmail(opts);

  console.log("[EMAIL] preparing customer confirmation");
  console.log("[EMAIL] recipient resolved:", toEmail);
  console.log("[EMAIL] course:", courseTitle, "| amount:", amountPaid, "| code:", accessCode);

  const result = await sendEmail(toEmail, subject, html, text);

  if (result.ok) {
    console.log("[EMAIL] sent successfully →", toEmail);
  } else {
    console.error("[EMAIL ERROR] send failed — recipient:", toEmail, "| error:", result.error);
  }
  return result;
}

// ─── Password reset email ─────────────────────────────────────────────────────

export function buildPasswordResetEmail(firstName: string, resetUrl: string) {
  const subject = "Recupero password IUSMK";
  const email = componiEmail({
    anteprima: "Reimposta la password del tuo account IUSMK. Il link vale 1 ora.",
    titolo: "Recupero password",
    saluto: `Ciao ${firstName},`,
    paragrafi: [
      "hai chiesto di reimpostare la password del tuo account IUSMK Academy.",
      "Premi il pulsante qui sotto per sceglierne una nuova. Il link vale 1 ora.",
    ],
    pulsante: { testo: "Reimposta la password", url: resetUrl },
    note: [
      "Se non sei stato tu, ignora questa email: il tuo account è al sicuro e la password non cambia.",
      `Se il pulsante non funziona, copia questo indirizzo nel browser: ${resetUrl}`,
    ],
    motivo: "Ricevi questa email perché è stato chiesto il recupero della password del tuo account IUSMK.",
  });
  return { subject, ...email };
}

export async function sendPasswordResetEmail(
  toEmail: string,
  firstName: string,
  resetToken: string,
): Promise<void> {
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    console.error("[RESET_LINK_ERROR] APP_URL mancante — email di reset NON inviata a:", toEmail);
    return;
  }

  // Normalize: strip trailing slash, add https:// if protocol is missing
  let baseUrl = appUrl.replace(/\/+$/, "");
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `https://${baseUrl}`;
    console.warn("[RESET_LINK_WARN] APP_URL non aveva protocollo, aggiunto https:// automaticamente:", baseUrl);
  }
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  console.log("[RESET_LINK] APP_URL usato:", baseUrl);
  console.log("[FORGOT_PASSWORD] tentativo invio email a:", toEmail);

  const { subject, html, text } = buildPasswordResetEmail(firstName, resetUrl);

  try {
    const { ok, error } = await sendEmail(toEmail, subject, html, text);
    if (ok) {
      console.log("[FORGOT_PASSWORD] email inviata con successo a:", toEmail);
    } else {
      console.error("[FORGOT_PASSWORD] invio fallito:", error);
    }
  } catch (err: any) {
    console.error("[FORGOT_PASSWORD] eccezione non gestita:", err?.message || err);
  }
}

// ─── Recesso dal contratto ───────────────────────────────────────────────────

export interface DatiRecesso {
  riferimento: string;
  ricevutoIl: Date;
  nome: string;
  email: string;
  contratto: string;
  dataAcquisto?: string | null;
  note?: string | null;
}

function righeRecesso(d: DatiRecesso) {
  const righe = [
    { etichetta: "Numero pratica", valore: d.riferimento },
    { etichetta: "Ricevuta il", valore: dataOraItaliana(d.ricevutoIl) },
    { etichetta: "Nome", valore: d.nome },
    { etichetta: "Email", valore: d.email },
    { etichetta: "Contratto / corso", valore: d.contratto },
  ];
  if (d.dataAcquisto) righe.push({ etichetta: "Data acquisto", valore: d.dataAcquisto });
  return righe;
}

/** Conferma di ricevimento al consumatore */
export function buildWithdrawalConfirmationEmail(d: DatiRecesso) {
  const appUrl = urlSito();
  const subject = `Abbiamo ricevuto il tuo recesso — pratica ${d.riferimento}`;
  const email = componiEmail({
    anteprima: `Recesso ricevuto il ${dataOraItaliana(d.ricevutoIl)}. Numero pratica ${d.riferimento}.`,
    titolo: "Recesso ricevuto",
    saluto: `Ciao ${d.nome},`,
    paragrafi: [
      "confermiamo di aver ricevuto la tua dichiarazione di recesso dal contratto. Conserva questa email: è la tua ricevuta.",
      "Ti rimborseremo entro 14 giorni da oggi, con lo stesso metodo di pagamento che hai usato, senza costi per te. Da ora l'accesso al corso può essere disattivato.",
    ],
    riepilogo: righeRecesso(d),
    note: [
      "Unica eccezione: se al pagamento avevi chiesto di accedere subito al corso e l'accesso è già iniziato, il diritto di recesso non si applica (art. 59 del Codice del Consumo). In quel caso ti scriviamo noi.",
      `Per qualsiasi domanda scrivi a ${IUSMK_EMAIL_CONTATTO} indicando il numero di pratica.`,
      `Le condizioni del recesso sono spiegate qui: ${appUrl}/returns`,
    ],
    motivo: "Ricevi questa email perché hai inviato una dichiarazione di recesso dal sito IUSMK.",
  });
  return { subject, ...email };
}

/** Avviso al titolare/amministratore */
export function buildWithdrawalAdminEmail(d: DatiRecesso) {
  const appUrl = urlSito();
  const subject = `Nuovo recesso da ${d.nome} — pratica ${d.riferimento}`;
  const riepilogo = righeRecesso(d);
  if (d.note) riepilogo.push({ etichetta: "Note del cliente", valore: d.note });
  const email = componiEmail({
    anteprima: `${d.nome} ha esercitato il recesso per «${d.contratto}». Rimborso entro 14 giorni.`,
    titolo: "Nuova richiesta di recesso",
    paragrafi: [
      `${d.nome} ha usato il pulsante «Recedi dal contratto» sul sito. La richiesta è salvata nei messaggi del pannello admin.`,
      "Cosa fare: verifica l'acquisto, esegui il rimborso da SumUp entro 14 giorni dal ricevimento e disattiva l'accesso al corso.",
    ],
    riepilogo,
    pulsante: { testo: "Apri il pannello", url: `${appUrl}/admin/contacts` },
    motivo: "Avviso automatico del sito IUSMK per il titolare.",
  });
  return { subject, ...email };
}

export async function sendWithdrawalEmails(
  d: DatiRecesso,
  opts: { toCustomer: boolean; adminEmail: string | null },
): Promise<{ customer: boolean; admin: boolean }> {
  const esito = { customer: false, admin: false };
  if (opts.toCustomer) {
    const m = buildWithdrawalConfirmationEmail(d);
    esito.customer = (await sendEmail(d.email, m.subject, m.html, m.text)).ok;
  }
  if (opts.adminEmail) {
    const m = buildWithdrawalAdminEmail(d);
    esito.admin = (await sendEmail(opts.adminEmail, m.subject, m.html, m.text)).ok;
  }
  return esito;
}
