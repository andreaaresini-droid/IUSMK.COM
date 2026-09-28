import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  adminsTable,
  contactRequestsTable,
  coursePurchasesTable,
  notificationsTable,
  studentsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { notifyAdmin } from "../lib/pushDispatch";
import { sendWithdrawalEmails } from "../lib/email";

// ─── Recesso online (art. 54-bis Codice del Consumo / dir. 2023/2673) ─────────
// Il consumatore compila il modulo su /recesso e conferma. La dichiarazione:
//   1. viene salvata in contact_requests (subject "withdrawal"), così compare nei
//      messaggi del pannello admin senza bisogno di nuove tabelle;
//   2. crea una notifica admin + push al titolare;
//   3. riceve una conferma di ricevimento con numero pratica e data/ora.
// Non serve essere registrati. Il rimborso resta un'operazione manuale del titolare.

const router: IRouter = Router();

// Limite semplice per IP: evita che il modulo venga usato per spam
const tentativi = new Map<string, { count: number; resetAt: number }>();
function consentito(ip: string): boolean {
  const ora = Date.now();
  const t = tentativi.get(ip);
  if (!t || ora > t.resetAt) {
    tentativi.set(ip, { count: 1, resetAt: ora + 10 * 60_000 });
    return true;
  }
  if (t.count >= 5) return false;
  t.count++;
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pulisci(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

router.post("/", async (req, res) => {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "sconosciuto";
  if (!consentito(ip)) {
    res.status(429).json({ error: "Too Many Requests", message: "Troppe richieste. Riprova tra qualche minuto." });
    return;
  }

  const nome = pulisci(req.body?.name, 120);
  const email = pulisci(req.body?.email, 200).toLowerCase();
  const contratto = pulisci(req.body?.contract, 300);
  const dataAcquisto = pulisci(req.body?.purchaseDate, 40) || null;
  const note = String(req.body?.notes ?? "").trim().slice(0, 1000) || null;
  const confermato = req.body?.confirm === true;

  if (!nome || !email || !contratto) {
    res.status(400).json({ error: "Bad Request", message: "Nome, email e contratto/corso sono obbligatori." });
    return;
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Bad Request", message: "Indirizzo email non valido." });
    return;
  }
  if (!confermato) {
    res.status(400).json({ error: "Bad Request", message: "Conferma il recesso per inviarlo." });
    return;
  }

  try {
    const ricevutoIl = new Date();
    const messaggio = [
      "DICHIARAZIONE DI RECESSO DAL CONTRATTO (inviata col pulsante «Recedi dal contratto»)",
      `Ricevuta il: ${ricevutoIl.toLocaleString("it-IT", { timeZone: "Europe/Rome" })}`,
      `Contratto / corso: ${contratto}`,
      dataAcquisto ? `Data acquisto indicata: ${dataAcquisto}` : null,
      note ? `Note del cliente: ${note}` : null,
      "Da fare: rimborso entro 14 giorni dal ricevimento, con lo stesso metodo di pagamento.",
    ].filter(Boolean).join("\n");

    const [salvata] = await db
      .insert(contactRequestsTable)
      .values({ name: nome, email, phone: null, subject: "withdrawal", message: messaggio })
      .returning();

    const riferimento = `REC-${String(salvata.id).padStart(5, "0")}`;
    req.log.info({ id: salvata.id, riferimento }, "Recesso registrato");

    await db.insert(notificationsTable).values({
      type:                "contact_request",
      title:               `RECESSO da ${nome} (${riferimento})`,
      message:             `[Recesso] ${contratto}`.slice(0, 200),
      isAdminNotification: true,
      isRead:              false,
      metadata:            JSON.stringify({
        contactId:    salvata.id,
        senderName:   nome,
        senderEmail:  email,
        subject:      "withdrawal",
        subjectLabel: "Recesso",
        riferimento,
      }),
    }).catch((err) => req.log.error({ err }, "Withdrawal notification insert error"));

    notifyAdmin({
      title: "Nuovo RECESSO — IUSMK",
      body: `${nome}: ${contratto}`.slice(0, 120),
      url: `/admin/contacts?id=${salvata.id}`,
    }).catch((err) => req.log.error({ err }, "Push send error"));

    // Email: la conferma parte solo verso indirizzi che conosciamo già (clienti o
    // acquisti), così il modulo non può essere usato per scrivere a sconosciuti a
    // nome di IUSMK. La conferma a schermo vale comunque come ricevuta.
    let clienteNoto = false;
    try {
      const [studente] = await db.select({ id: studentsTable.id }).from(studentsTable)
        .where(eq(studentsTable.email, email)).limit(1);
      const [acquisto] = studente ? [studente] : await db.select({ id: coursePurchasesTable.id })
        .from(coursePurchasesTable)
        .where(sql`lower(${coursePurchasesTable.customerEmail}) = ${email}`).limit(1);
      clienteNoto = !!acquisto;
    } catch (err) {
      req.log.error({ err }, "Withdrawal customer lookup error");
    }

    let adminEmail: string | null = null;
    try {
      const [admin] = await db.select({ email: adminsTable.email }).from(adminsTable).limit(1);
      adminEmail = admin?.email || null;
    } catch (err) {
      req.log.error({ err }, "Withdrawal admin lookup error");
    }

    const esitoEmail = await sendWithdrawalEmails(
      { riferimento, ricevutoIl, nome, email, contratto, dataAcquisto, note },
      { toCustomer: clienteNoto, adminEmail },
    ).catch((err) => {
      req.log.error({ err }, "Withdrawal email error");
      return { customer: false, admin: false };
    });

    res.json({
      success: true,
      reference: riferimento,
      receivedAt: ricevutoIl.toISOString(),
      emailSent: esitoEmail.customer,
    });
  } catch (err) {
    req.log.error({ err }, "Submit withdrawal error");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Non siamo riusciti a registrare il recesso. Riprova o scrivi a iusmkbarber@gmail.com.",
    });
  }
});

export default router;
