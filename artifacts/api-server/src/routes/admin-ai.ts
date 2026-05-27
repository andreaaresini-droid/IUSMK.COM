import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { knowledgeBaseTable, unansweredQuestionsTable, aiChatLogsTable } from "@workspace/db/schema";
import { eq, desc, count, and, gte, sql } from "drizzle-orm";
import { requireAdmin, AuthRequest } from "../middlewares/authMiddleware.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  sanitizeInput,
  normalizeText,
  extractTokens,
  expandTokens,
  searchKB,
  buildContext,
  buildSystemPrompt,
  MIN_SCORE_THRESHOLD,
} from "../lib/kb-search.js";

const router: IRouter = Router();
router.use(requireAdmin as any);

// ═══════════════════════════════════════════════════════════
// KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════

router.get("/knowledge-base", async (req: AuthRequest, res) => {
  try {
    const items = await db
      .select()
      .from(knowledgeBaseTable)
      .orderBy(desc(knowledgeBaseTable.updatedAt));
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "KB list error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/knowledge-base", async (req: AuthRequest, res) => {
  try {
    const { title, content, category, keywords, sourceType, sourcePath, isPublished, isActive } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: "title e content sono obbligatori" }); return;
    }
    const [item] = await db.insert(knowledgeBaseTable).values({
      title:         String(title).slice(0, 255),
      content:       String(content),
      category:      String(category || "generale").slice(0, 100),
      keywords:      String(keywords || ""),
      sourceType:    String(sourceType || "manual_entry").slice(0, 50),
      sourcePath:    String(sourcePath || ""),
      isPublished:   isPublished !== false,
      isActive:      isActive !== false,
      createdBy:     "admin",
      lastUpdatedBy: "admin",
      updatedAt:     new Date(),
    }).returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "KB create error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/knowledge-base/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
    const { title, content, category, keywords, sourceType, sourcePath, isPublished, isActive } = req.body;
    const u: Record<string, unknown> = { updatedAt: new Date(), lastUpdatedBy: "admin" };
    if (title       !== undefined) u.title       = String(title).slice(0, 255);
    if (content     !== undefined) u.content     = String(content);
    if (category    !== undefined) u.category    = String(category).slice(0, 100);
    if (keywords    !== undefined) u.keywords    = String(keywords);
    if (sourceType  !== undefined) u.sourceType  = String(sourceType).slice(0, 50);
    if (sourcePath  !== undefined) u.sourcePath  = String(sourcePath);
    if (isPublished !== undefined) u.isPublished = Boolean(isPublished);
    if (isActive    !== undefined) u.isActive    = Boolean(isActive);
    const [item] = await db
      .update(knowledgeBaseTable).set(u as any)
      .where(eq(knowledgeBaseTable.id, id)).returning();
    if (!item) { res.status(404).json({ error: "Non trovato" }); return; }
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "KB update error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/knowledge-base/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
    await db.delete(knowledgeBaseTable).where(eq(knowledgeBaseTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "KB delete error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ═══════════════════════════════════════════════════════════
// UNANSWERED QUESTIONS
// ═══════════════════════════════════════════════════════════

router.get("/unanswered-questions", async (req: AuthRequest, res) => {
  try {
    const items = await db
      .select()
      .from(unansweredQuestionsTable)
      .orderBy(desc(unansweredQuestionsTable.lastAskedAt));
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Unanswered list error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/unanswered-questions/count", async (req: AuthRequest, res) => {
  try {
    const [result] = await db
      .select({ count: count() })
      .from(unansweredQuestionsTable)
      .where(eq(unansweredQuestionsTable.status, "new"));
    res.json({ count: Number(result.count) });
  } catch (err) {
    req.log.error({ err }, "Unanswered count error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/unanswered-questions/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
    const { status, adminAnswer, handledBy } = req.body;
    const u: Record<string, unknown> = { updatedAt: new Date() };
    if (status      !== undefined) u.status      = String(status);
    if (adminAnswer !== undefined) u.adminAnswer = String(adminAnswer);
    if (handledBy   !== undefined) u.handledBy   = String(handledBy);
    const [item] = await db
      .update(unansweredQuestionsTable).set(u as any)
      .where(eq(unansweredQuestionsTable.id, id)).returning();
    if (!item) { res.status(404).json({ error: "Non trovato" }); return; }
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Unanswered update error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/unanswered-questions/:id/publish", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

    const [q] = await db
      .select()
      .from(unansweredQuestionsTable)
      .where(eq(unansweredQuestionsTable.id, id));
    if (!q)               { res.status(404).json({ error: "Domanda non trovata" }); return; }
    if (!q.adminAnswer?.trim()) { res.status(400).json({ error: "Inserisci prima una risposta admin" }); return; }

    const kbTitle  = req.body.title || `Domanda: ${q.question.slice(0, 200)}`;
    const kbCat    = req.body.category || "faq";

    const [kbItem] = await db.insert(knowledgeBaseTable).values({
      title:         String(kbTitle).slice(0, 255),
      content:       q.adminAnswer!,
      category:      String(kbCat),
      keywords:      q.normalizedQuestion,
      sourceType:    "manual_entry",
      isPublished:   true,
      isActive:      true,
      createdBy:     "admin",
      lastUpdatedBy: "admin",
      updatedAt:     new Date(),
    }).returning();

    await db
      .update(unansweredQuestionsTable)
      .set({
        status:                "answered",
        linkedKnowledgeItemId: kbItem.id,
        handledBy:             "admin",
        updatedAt:             new Date(),
      })
      .where(eq(unansweredQuestionsTable.id, id));

    res.json({ ok: true, knowledgeItem: kbItem });
  } catch (err) {
    req.log.error({ err }, "Publish to KB error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ═══════════════════════════════════════════════════════════
// AI CHAT LOGS
// ═══════════════════════════════════════════════════════════

router.get("/chat-logs", async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "100", 10), 500);
    const logs  = await db
      .select()
      .from(aiChatLogsTable)
      .orderBy(desc(aiChatLogsTable.createdAt))
      .limit(limit);
    res.json(logs);
  } catch (err) {
    req.log.error({ err }, "Chat logs error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ═══════════════════════════════════════════════════════════
// STATS (for dashboard + overview page)
// ═══════════════════════════════════════════════════════════

router.get("/stats", async (req: AuthRequest, res) => {
  try {
    const now       = new Date();
    const since24h  = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [newQ]      = await db.select({ count: count() }).from(unansweredQuestionsTable).where(eq(unansweredQuestionsTable.status, "new"));
    const [kbPub]     = await db.select({ count: count() }).from(knowledgeBaseTable).where(and(eq(knowledgeBaseTable.isPublished, true), eq(knowledgeBaseTable.isActive, true)));
    const [kbTotal]   = await db.select({ count: count() }).from(knowledgeBaseTable);
    const [logs24h]   = await db.select({ count: count() }).from(aiChatLogsTable).where(gte(aiChatLogsTable.createdAt, since24h));
    const [fallback24h] = await db.select({ count: count() }).from(aiChatLogsTable).where(and(gte(aiChatLogsTable.createdAt, since24h), eq(aiChatLogsTable.usedFallback, true)));
    const [handledToday] = await db.select({ count: count() }).from(unansweredQuestionsTable).where(and(gte(unansweredQuestionsTable.updatedAt, todayMidnight), eq(unansweredQuestionsTable.status, "answered")));

    res.json({
      newUnanswered:    Number(newQ.count),
      kbPublished:      Number(kbPub.count),
      kbTotal:          Number(kbTotal.count),
      chatsLast24h:     Number(logs24h.count),
      fallbacksLast24h: Number(fallback24h.count),
      handledToday:     Number(handledToday.count),
    });
  } catch (err) {
    req.log.error({ err }, "AI stats error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ═══════════════════════════════════════════════════════════
// SEED KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════

// Titles of OLD wrong entries to remove from production DB on seed
const KB_STALE_TITLES = [
  "Chiamate o messaggi a IUSMK",
  "Contatti IUSMK - numero telefono",
  "Recupero password",
  "Problemi di accesso account",
  "Dove vedere le notifiche del proprio account",
  "Cosa fare dopo l'acquisto di un corso",
  "Dove trovare il codice del corso",
  "Se non trovo il codice del corso",
  "Cosa si può acquistare sul sito",
  // superseded by dedicated iPhone/Android entries + better keyword versions
  "Come aggiungere IUSMK alla schermata Home",
  "Come installare il sito IUSMK sul telefono",
  "Come rispondere su notifiche push e home screen",
  "Come attivare le notifiche push",
  "Si può usare IUSMK come un'app?",
];

const KB_SEED_ENTRIES = [
  { title: "Chi è IUSMK", category: "sito", keywords: "chi è iusmk, barber, artista, formazione, giuseppe musto", content: "IUSMK è un barber artist che usa il sito per presentare la propria attività e mettere a disposizione contenuti formativi come videocorsi dedicati al settore barber." },
  { title: "Sedi: Milano e Londra", category: "contatti", keywords: "sede, dove, città, milano, londra, indirizzo, location", content: "IUSMK opera principalmente in due città: Milano (Italia) e Londra (UK). Per informazioni aggiornate sulla sede contattare tramite il modulo contatto o i social ufficiali." },
  { title: "Servizi offerti", category: "servizi", keywords: "servizi, taglio, fade, barba, capelli, styling, cosa fa", content: "IUSMK offre tagli capelli maschili personalizzati, fade di precisione, correzione barba e styling. I servizi sono su appuntamento. Offre anche corsi di formazione professionale." },
  { title: "Academy e Corsi", category: "corsi", keywords: "academy, corsi, formazione, video, lezioni, barber, tecnica", content: "L'IUSMK Academy offre corsi video professionali per barber. Acquistabili via Stripe oppure accessibili con codice a 6 cifre. I video sono disponibili nell'area personale dopo acquisto o attivazione codice." },
  { title: "Prenotazioni: il sito non gestisce appuntamenti", category: "sito", keywords: "prenotazioni, appuntamenti, tagli, taglio, barba, booking, prenotare, prenotazione", content: "Il sito IUSMK non è un sistema per prenotare tagli o appuntamenti. Non è possibile prenotare sessioni in presenza tramite il sito. Il sito serve principalmente per conoscere IUSMK e acquistare i suoi videocorsi." },
  { title: "Contatti IUSMK (informazioni generali)", category: "contatti", keywords: "contatti, sede, dove, indirizzo, email, instagram", content: "Giuseppe è barber artist con base a Milano e Londra. Per contatti usa email, Instagram o la sezione Contatto del menu del sito." },
  { title: "Prezzi servizi", category: "prezzi", keywords: "prezzi, costo, quanto costa, tariffe, listino", content: "I prezzi variano in base al servizio e alla sede. Per informazioni aggiornate contattare IUSMK direttamente. I corsi hanno i prezzi indicati nella pagina del corso." },
  { title: "Account e acquisto corsi", category: "corsi", keywords: "account, registrazione, login, acquisto, pagamento, stripe", content: "Per acquistare i corsi crea un account gratuito sul sito (sezione Registrati). Dopo il login puoi acquistare via Stripe. I contenuti video sono accessibili subito dopo il pagamento." },
  { title: "Codice di accesso a 6 cifre", category: "corsi", keywords: "codice, accesso, 6 cifre, attivare, codice segreto, inserire", content: "Alcuni corsi possono essere attivati con un codice a 6 cifre fornito da Giuseppe Musto. Vai alla sezione Accesso del sito, digita il codice ricevuto e avrai accesso immediato al corso." },
  { title: "Password dimenticata - come resettarla", category: "password", keywords: "password dimenticata, reset password, recupero password, non ricordo password, email reset, link reset, spam", content: "Se hai dimenticato la password: vai su \"Accedi\", clicca su \"Password dimenticata\", inserisci la tua email e attendi l'email con il link per il reset. Se l'email non arriva controlla la cartella spam." },
  { title: "A cosa serve il sito IUSMK", category: "sito", keywords: "sito iusmk, a cosa serve, giuseppe, barber artist, informazioni, presentazione", content: "Il sito IUSMK serve per mostrare chi è Giuseppe, cosa fa e per permettere agli utenti di acquistare i suoi corsi. Il sito non è un sistema di prenotazione appuntamenti." },
  { title: "Prenotazioni tagli", category: "sito", keywords: "prenotazioni, appuntamenti, tagli, taglio, barba, booking, prenotare, prenotazione", content: "Al momento il sito IUSMK non è pensato per prenotare tagli o appuntamenti. Serve soprattutto per conoscere IUSMK e acquistare i suoi videocorsi." },
  { title: "Il sito serve per acquistare corsi", category: "corsi", keywords: "masterclass, corsi, formazione, acquisto corsi, comprare corso, cosa si compra", content: "Il sito IUSMK permette di acquistare i corsi dedicati ai contenuti di Giuseppe. I corsi si trovano nella sezione \"Corsi\" del menu." },
  { title: "Contenuti dei corsi IUSMK", category: "corsi", keywords: "corsi, tagli, sfumature, colori, formazione, barber", content: "I corsi IUSMK sono contenuti formativi che insegnano tecniche barber, come tagli, sfumature, colori e lavorazioni simili. I contenuti possono variare in base al corso acquistato." },
  { title: "Come si sbloccano i corsi acquistati", category: "accesso", keywords: "sbloccare corso, codice, accesso corso, notifiche, acquisto, sblocco, sblocca, trovare", content: "Dopo l'acquisto, il corso si sblocca tramite un codice. Il codice viene inviato nella sezione notifiche del cliente all'interno del sito." },
  { title: "Dove arriva il codice del corso", category: "notifiche", keywords: "codice corso, dove arriva il codice, notifiche, sbloccare corso, dove trovare codice", content: "Dopo l'acquisto, il codice arriva nella sezione \"Notifiche\" del menu, all'interno del tuo account. Devi essere connesso per vederlo." },
  { title: "Cosa fare se non trovo il codice del corso", category: "supporto", keywords: "non trovo codice, codice assente, notifiche, corso bloccato, codice mancante", content: "Se non trovi il codice del corso: verifica di aver effettuato l'accesso al tuo account e poi controlla la sezione \"Notifiche\" nel menu." },
  { title: "Politica resi", category: "policy", keywords: "resi, rimborso, restituzione, acquisto, policy", content: "Per eventuali richieste di reso o rimborso, il cliente deve contattare personalmente Giuseppe. Sarà Giuseppe a valutare caso per caso se effettuare o meno il reso." },
  { title: "Come richiedere un reso", category: "policy", keywords: "richiedere reso, rimborso, giuseppe, supporto", content: "Le richieste di reso non sono automatiche. Il cliente deve contattare direttamente Giuseppe e spiegare la situazione. La decisione finale sul reso viene presa personalmente da Giuseppe." },
  { title: "Contatti IUSMK", category: "contatti", keywords: "contatti, email, instagram, modulo contatto, come contattare", content: "I contatti ufficiali di Giuseppe sono: email, Instagram e la sezione Contatto del menu del sito. Non è previsto contatto tramite telefono o WhatsApp." },
  { title: "Come contattare Giuseppe", category: "contatti", keywords: "contattare giuseppe, contatti, email, instagram, modulo contatto, assistenza", content: "Per contattare Giuseppe non si usa WhatsApp o telefono. I contatti disponibili sono: email, Instagram e la sezione Contatto nel menu del sito." },
  { title: "Come accedere al proprio account", category: "accesso", keywords: "accedi, login, entrare, account, profilo, accesso", content: "Per accedere al proprio account usa il tasto \"Accedi\" in alto a destra del sito. Se non hai ancora un account clicca su \"Registrati ora\"." },
  { title: "Dove trovare le notifiche", category: "notifiche", keywords: "notifiche, menu notifiche, dove sono le notifiche, account, codice corso", content: "Le notifiche si trovano nella sezione \"Notifiche\" del menu, dopo aver effettuato l'accesso al proprio account." },
  { title: "Il sito IUSMK vende servizi in presenza", category: "sito", keywords: "servizi, presenza, taglio, tagli, barber shop, appuntamento, prenotare", content: "Il sito IUSMK non è pensato come sistema di prenotazione di servizi in presenza. È principalmente una piattaforma informativa e formativa dedicata all'attività di IUSMK e ai suoi corsi." },
  { title: "Assistenza clienti IUSMK", category: "supporto", keywords: "assistenza, aiuto, supporto, clienti, contatti", content: "Per assistenza su accesso, corsi, codici, resi o informazioni generali, il cliente può usare le informazioni presenti sul sito oppure contattare direttamente Giuseppe quando necessario." },
  { title: "Codici di accesso ai corsi", category: "accesso", keywords: "codici accesso, corsi, sblocco, notifiche, sbloccare, trovare, dove", content: "I codici di accesso servono a sbloccare i corsi acquistati. Dopo l'acquisto, il cliente deve controllare la sezione notifiche del proprio account per trovare il codice ricevuto." },
  { title: "Se l assistente AI non conosce una risposta", category: "supporto", keywords: "assistente ai, risposta mancante, informazione mancante", content: "Se l'assistente AI non trova una risposta certa nelle informazioni disponibili, informerà il cliente che al momento non può dare quell'informazione con certezza e segnalerà la richiesta all'admin per aggiornare la Knowledge Base." },
  { title: "Cosa succede dopo l'acquisto di un corso", category: "corsi", keywords: "dopo acquisto, dopo aver comprato, corso acquistato, notifiche, cosa succede", content: "Dopo aver acquistato un corso, riceverai una notifica nella sezione \"Notifiche\" del menu del tuo account con il codice per sbloccare il corso." },
  { title: "Se l'assistente AI non conosce una risposta", category: "supporto", keywords: "assistente ai, risposta mancante, informazione mancante", content: "Se l'assistente AI non trova una risposta certa nelle informazioni disponibili, informerà il cliente che al momento non può dare quell'informazione con certezza e segnalerà la richiesta all'admin per aggiornare la Knowledge Base." },
  { title: "Come acquistare un corso", category: "corsi", keywords: "acquisto corso, comprare corso, comprare, acquistare, corsi menu, dove acquistare, come compro, come acquisto", content: "Per acquistare un corso bisogna entrare nella sezione \"Corsi\" dal menu del sito e completare l'acquisto da lì. Dopo il pagamento ricevi un codice nella sezione Notifiche." },
  { title: "Come prenotare un taglio con IUSMK", category: "prenotazioni", keywords: "prenotare taglio, appuntamento, booking, come prenotare, prenotazione online", content: "Il sito IUSMK non gestisce prenotazioni online per tagli o appuntamenti. Per prenotare un appuntamento con Giuseppe usa email, Instagram o la sezione Contatto del menu del sito." },
  { title: "Si possono prenotare appuntamenti dal sito?", category: "prenotazioni", keywords: "prenotare, appuntamento, booking, taglio, barba, prenotazione, posso prenotare", content: "No, dal sito IUSMK non è possibile effettuare prenotazioni. Il sito serve solo per mostrare chi è Giuseppe, cosa fa e per acquistare i corsi disponibili." },
  { title: "Come prenotare un appuntamento", category: "prenotazioni", keywords: "come prenoto, appuntamento, prenotazione, taglio, barba, come si prenota", content: "Al momento il sito IUSMK non permette di prenotare appuntamenti. Per qualsiasi richiesta di appuntamento usa email, Instagram o la sezione Contatto del menu." },
  { title: "Dove si comprano i corsi", category: "corsi", keywords: "comprare corso, acquistare corso, corsi, dove comprare, menu corsi, sezione corsi", content: "I corsi si acquistano dal sito nella sezione \"Corsi\" presente nel menu." },
  { title: "A cosa serve il codice del corso", category: "corsi", keywords: "codice corso, sbloccare corso, accesso corso, codice accesso, a cosa serve il codice", content: "Il codice ricevuto dopo l'acquisto serve per sbloccare il corso acquistato." },
  { title: "Per vedere il codice bisogna accedere all account", category: "accesso", keywords: "account, accedere, login, notifiche, codice corso, bisogna entrare", content: "Sì, per vedere la notifica con il codice del corso bisogna prima effettuare l'accesso al proprio account." },
  { title: "Come creare un account", category: "account", keywords: "creare account, registrazione, registrarsi, accedi, registrati ora, nuovo account", content: "Per creare un account bisogna premere in alto a destra su \"Accedi\" e poi su \"Registrati ora\"." },
  { title: "Come registrarsi al sito", category: "account", keywords: "registrati, registrazione, creare profilo, nuovo account, come mi registro, iscriversi", content: "Chi non ha ancora un account può registrarsi cliccando su \"Accedi\" in alto a destra e poi su \"Registrati ora\"." },
  { title: "Si può contattare Giuseppe su WhatsApp?", category: "contatti", keywords: "whatsapp, telefono, numero, chiamare, messaggio, whatsapp giuseppe", content: "No, Giuseppe non si contatta tramite WhatsApp o numero di telefono. I contatti disponibili sono email, Instagram e la sezione Contatto del sito." },
  { title: "Si può chiamare Giuseppe al telefono?", category: "contatti", keywords: "telefono, chiamare, numero, contatto telefonico, numero telefono giuseppe", content: "No, il contatto telefonico non è previsto. Per contattare Giuseppe usa email, Instagram oppure la sezione Contatto del menu del sito." },
  { title: "Contattare Giuseppe tramite sezione Contatto", category: "contatti", keywords: "contatto, menu contatto, richiesta, messaggio sito, modulo contatto", content: "Per qualsiasi richiesta puoi contattare Giuseppe tramite la sezione Contatto presente nel menu del sito." },
  { title: "Contatti ufficiali di Giuseppe", category: "contatti", keywords: "email, instagram, contatti ufficiali, supporto, come si contatta", content: "I contatti ufficiali di Giuseppe sono: email, Instagram e la sezione Contatto del menu del sito. Non è previsto contatto telefonico o via WhatsApp." },
  { title: "Link Instagram di Giuseppe", category: "contatti", keywords: "instagram, profilo instagram, link instagram, social, instagram giuseppe", content: "Per contattare Giuseppe tramite Instagram usa questo link: [INSERIRE_LINK_INSTAGRAM_REALE]" },
  { title: "Email di contatto di Giuseppe", category: "contatti", keywords: "email, mail, contatto email, supporto email, email giuseppe", content: "Per contattare Giuseppe tramite email usa questo indirizzo: [INSERIRE_EMAIL_REALE]" },
  { title: "Bisogna avere un account per notifiche e codici?", category: "account", keywords: "account notifiche, login, codice corso, accesso utente, bisogna essere loggati", content: "Sì, per visualizzare notifiche e codici bisogna essere connessi al proprio account." },
  { title: "Domande su funzioni non disponibili", category: "supporto", keywords: "funzione non disponibile, prenotazione, whatsapp, telefono, non disponibile", content: "Se un utente chiede una funzione non disponibile (come prenotazioni dal sito o contatto via WhatsApp/telefono), l'assistente deve chiarire che quella funzione non è prevista e indicare il metodo corretto disponibile." },
  { title: "Come rispondere sulle prenotazioni", category: "supporto", keywords: "prenotazione, appuntamento, taglio, risposta assistente, come rispondo", content: "Se un utente chiede come prenotare, la risposta è: dal sito non si effettuano prenotazioni. Il sito serve solo a mostrare chi è Giuseppe, cosa fa e a vendere i corsi." },
  { title: "Come rispondere sui contatti", category: "supporto", keywords: "contatti assistente, email, instagram, contatto menu, risposta contatti", content: "Se un utente chiede come contattare Giuseppe: non si usa WhatsApp o telefono. I contatti disponibili sono email, Instagram e la sezione Contatto del menu." },
  { title: "Come rispondere su login e password", category: "supporto", keywords: "login, password, registrazione, reset, email spam, accesso problemi", content: "Per problemi di accesso: per registrarsi cliccare su Accedi poi Registrati ora. Per password dimenticata: cliccare su Password dimenticata nella schermata di accesso, inserire email, attendere email di reset e controllare anche lo spam." },
  {
    title: "Come attivare le notifiche push",
    category: "notifiche",
    keywords: "notifiche push, attivare notifiche, push notification, come attivo le notifiche, come attivo notifiche push, come posso attivare le notifiche, come faccio ad attivare le notifiche, come ricevo le notifiche, dove attivo le notifiche, come abilito le notifiche push, abilitare notifiche, notifiche sito, attivo notifiche, attivare push",
    content: "Per attivare le notifiche push devi:\n1. Accedere al tuo account sul sito IUSMK\n2. Aprire il menu del sito\n3. Entrare nella sezione \"Notifiche\"\n4. Premere il tasto per attivare le notifiche push\n\nDopo l'attivazione potrai ricevere notifiche su messaggi, corsi e aggiornamenti del sito.",
  },
  {
    title: "Come aggiungere IUSMK alla schermata Home su iPhone",
    category: "sito",
    keywords: "home screen iphone, aggiungere sito alla home iphone, aggiungo sito alla home, schermata home iphone, usare sito come app iphone, installare sito iphone, aggiungere iusmk alla schermata iniziale, icona sito telefono, safari aggiungi a home, metto il sito sulla home, app iphone, installare iusmk iphone",
    content: "Su iPhone puoi aggiungere IUSMK alla schermata Home così:\n1. Apri il sito con Safari\n2. Premi il tasto Condividi (icona con freccia in alto)\n3. Scorri e seleziona \"Aggiungi a Home\"\n4. Conferma\n\nDopo averlo aggiunto, potrai aprire IUSMK dalla schermata Home come se fosse un'app.",
  },
  {
    title: "Come aggiungere IUSMK alla schermata Home su Android",
    category: "sito",
    keywords: "home screen android, aggiungere sito alla home android, aggiungo sito alla home android, schermata home android, usare sito come app android, installare sito android, aggiungere iusmk alla schermata iniziale android, chrome aggiungi a schermata home, installa app android, metto il sito sulla home android, app android, installare iusmk android",
    content: "Su Android puoi aggiungere IUSMK alla schermata Home così:\n1. Apri il sito con Chrome\n2. Premi il menu del browser (tre puntini in alto a destra)\n3. Seleziona \"Aggiungi a schermata Home\" oppure \"Installa app\" se disponibile\n4. Conferma\n\nDopo averlo aggiunto, potrai aprire IUSMK dalla schermata Home come se fosse un'app.",
  },
  {
    title: "Come aggiungere IUSMK alla Home e attivare le notifiche",
    category: "sito",
    keywords: "aggiungere sito e attivare notifiche, usare come app e notifiche, installare iusmk e attivare notifiche, home e notifiche, schermata home e push, iusmk app notifiche, aggiungo sito attivo notifiche, entrambe le cose app e notifiche",
    content: "Per usare IUSMK come un'app e attivare le notifiche:\n1. Aggiungi il sito alla schermata Home (su iPhone con Safari → Condividi → Aggiungi a Home; su Android con Chrome → menu → Aggiungi a schermata Home)\n2. Apri IUSMK dalla schermata Home\n3. Accedi al tuo account\n4. Apri il menu del sito\n5. Entra nella sezione \"Notifiche\"\n6. Premi il tasto per attivare le notifiche push",
  },
  {
    title: "Si può usare IUSMK come un'app?",
    category: "sito",
    keywords: "usare come app, applicazione iusmk, iusmk app, app giuseppe, installare come app, sito come app, app telefono, app iphone android, pwa, web app, installare iusmk, iusmk sul telefono, aggiungere iusmk al telefono",
    content: "Sì, puoi usare IUSMK come un'app aggiungendolo alla schermata Home del tuo telefono.\n\nSu iPhone: apri il sito con Safari, premi il tasto Condividi e seleziona \"Aggiungi a Home\".\nSu Android: apri il sito con Chrome, premi il menu del browser e scegli \"Aggiungi a schermata Home\" o \"Installa app\".\n\nDopo averlo aggiunto, IUSMK si apre dalla schermata Home come una normale app.",
  },
];

router.post("/seed-kb", async (req: AuthRequest, res) => {
  try {
    // Remove old/wrong stale entries first
    let removed = 0;
    for (const staleTitle of KB_STALE_TITLES) {
      const existing = await db
        .select({ id: knowledgeBaseTable.id })
        .from(knowledgeBaseTable)
        .where(sql`lower(trim(${knowledgeBaseTable.title})) = ${staleTitle.toLowerCase().trim()}`);
      if (existing.length > 0) {
        await db.delete(knowledgeBaseTable).where(sql`lower(trim(${knowledgeBaseTable.title})) = ${staleTitle.toLowerCase().trim()}`);
        removed += existing.length;
      }
    }

    const existingRows = await db.select({ title: knowledgeBaseTable.title }).from(knowledgeBaseTable);
    const existingTitles = new Set(existingRows.map((e) => e.title.toLowerCase().trim()));

    let created = 0;
    let skipped = 0;

    for (const entry of KB_SEED_ENTRIES) {
      if (existingTitles.has(entry.title.toLowerCase().trim())) {
        skipped++;
        continue;
      }
      await db.insert(knowledgeBaseTable).values({
        title:       entry.title,
        content:     entry.content,
        category:    entry.category,
        keywords:    entry.keywords,
        sourceType:  "manual_entry",
        isPublished: true,
        isActive:    true,
        createdBy:   (req as AuthRequest).userEmail ?? "admin",
        lastUpdatedBy: (req as AuthRequest).userEmail ?? "admin",
      });
      existingTitles.add(entry.title.toLowerCase().trim());
      created++;
    }

    res.json({ created, skipped, removed, total: KB_SEED_ENTRIES.length });
  } catch (err) {
    req.log.error({ err }, "KB seed error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /api/admin/ai/test ───────────────────────────────────────────────
// Full debug run: returns tokens, KB matches, system prompt and AI answer.
router.post("/test", async (req, res) => {
  try {
    const { question = "" } = req.body as { question: string };
    const sanitized = sanitizeInput(question.trim());
    if (sanitized.length < 2) {
      res.status(400).json({ error: "Domanda troppo corta." });
      return;
    }
    const normalized = normalizeText(sanitized);
    const originalTokens = extractTokens(sanitized);
    const expandedTokens = expandTokens(originalTokens);

    const debugLines: string[] = [];
    const dbg = (msg: string) => debugLines.push(msg);

    const results = await searchKB(sanitized, dbg);
    const topScore   = results[0]?.score ?? 0;
    const hasContext = topScore >= MIN_SCORE_THRESHOLD;

    let aiAnswer: string | null = null;
    let systemPromptUsed: string | null = null;

    if (hasContext) {
      const context = buildContext(results);
      systemPromptUsed = buildSystemPrompt(context, "it");

      // Use streaming and collect all chunks (gpt-5-mini only works in stream mode)
      const stream = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 700,
        messages: [
          { role: "system", content: systemPromptUsed },
          { role: "user",   content: sanitized },
        ],
        stream: true,
      });
      let collected = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) collected += delta;
      }
      aiAnswer = collected || "(nessuna risposta — stream vuoto)";
    } else {
      aiAnswer = "FALLBACK — nessun contesto KB trovato sopra la soglia.";
    }

    res.json({
      sanitized,
      normalized,
      originalTokens,
      expandedTokens,
      threshold: MIN_SCORE_THRESHOLD,
      topScore,
      hasContext,
      kbMatches: results.map((r) => ({
        id:        r.id,
        title:     r.title,
        category:  r.category,
        keywords:  r.keywords,
        score:     r.score,
        contentPreview: r.content.slice(0, 120),
      })),
      debugLog: debugLines,
      systemPromptUsed,
      aiAnswer,
    });
  } catch (err) {
    req.log.error({ err }, "AI test error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
